# 설계 문서 — dart-risk-api

- **date**: 2026-08-24
- **phase**: 7 / 8 기준 스냅샷

Phase 0~6까지 쌓인 아키텍처를 한 곳에 정리하고, Phase 7 k6 부하 테스트 결과와 병목 분석을 남긴다.

## 1. 전체 아키텍처

```
[DART Open API] ---collect---> [Postgres: Company/Disclosure] --extract--> [rawText 저장]
                                                                     |
                                                                  classify
                                                                     v
                                                        [Postgres: RiskFlag]

BullMQ 큐 3개(collect-disclosures / extract-text / classify-risk)가 위 파이프라인을 잇는다.
각 단계는 완료 시 다음 단계 job을 스스로 enqueue한다 (collect → extract → classify 체이닝).

[Express API] --requireApiKey--> [Redis 캐시 30s] --cache miss--> [Postgres 조회]
```

- **수집~분류 파이프라인**(Phase 1~4): 워치리스트 80개 기업 × 사업보고서/감사보고서만 대상. 룰 기반 리스크 분류(Claude API는 크레딧 확보 전까지 대체).
- **조회 API**(Phase 5): 파이프라인이 채운 데이터를 읽기 전용으로 노출. 쓰기 경로는 API에 없음 — 항상 워커가 채움.
- **큐/재시도**(Phase 4): exponential backoff 3회 → dead-letter. 워커 프로세스가 개별 job 실패로 죽지 않도록 전역 예외 핸들러 보유.
- **로깅**(Phase 6): pino로 구조화. `JobLog` 테이블에 job 시도별 실행 이력, API는 pino-http로 요청 로그.

## 2. 캐시 전략

`cacheResponse()` 미들웨어가 `res.json`을 감싸서 `/api` 전체에 적용됨(라우터 코드 무변경). 캐시 키는 `req.originalUrl` — 즉 **쿼리 파라미터까지 포함한 전체 URL**이 키다. 이 설계의 함의:

- 동일 쿼리 반복 호출(대시보드가 같은 화면을 계속 갱신하는 경우)은 TTL(30초) 동안 거의 다 캐시로 처리됨.
- 페이지네이션(`offset=`)처럼 쿼리가 매번 바뀌는 접근 패턴은 캐시 키가 매번 달라져 MISS가 잦음 — 아래 부하 테스트에서 실측.

## 3. Phase 7 — k6 부하 테스트

### 3.1 시나리오 설계

같은 서버 자원을 두고 "캐시가 거의 항상 먹히는 접근 패턴"과 "캐시 키가 매번 달라지는 접근 패턴"을 시간을 나눠 비교했다.

| 시나리오 | 엔드포인트 | 접근 패턴 | 목적 |
|---|---|---|---|
| `cache_hit` | `GET /api/companies/{corpCode}/disclosures` | 항상 동일한 corpCode 조회 | 캐시 HIT 상태의 응답시간 측정 |
| `cache_miss` | `GET /api/risk-flags?limit=10&offset=N` | `offset`을 VU/iteration 조합으로 매번 고유하게 생성 | 캐시가 전혀 안 먹히는 최악 케이스 측정 |

두 시나리오 모두 `ramping-vus`로 0 → 20 VU까지 10초간 증가, 20초 유지, 5초간 감소 (각 35초, 총 70초). 실행: `npm run loadtest` (`.env`의 `API_KEY`/`PORT`를 읽어 k6에 전달).

> **시행착오**: 처음에는 `offset`을 0~500 사이 난수로 생성했는데, 요청량(초당 100건 이상)에 비해 난수 공간이 좁아서 30초 TTL 안에 같은 offset이 반복 등장 — "캐시 미스 시나리오"인데도 90%가 HIT로 나왔다. `offset = __VU * 100000 + __ITER`로 바꿔서 전체 실행에서 절대 겹치지 않게 수정한 뒤에야 의도한 대로 100% MISS가 나왔다.

### 3.2 결과 (로컬 M-series, Postgres/Redis 로컬)

| 지표 | cache_hit | cache_miss |
|---|---|---|
| 실제 X-Cache 비율 | HIT 5286 / MISS 18 (99.7%) | MISS 4721 / HIT 0 (100%) |
| p95 응답시간 | **4.52ms** | **21.77ms** |
| 평균 응답시간 | 2.51ms | 15.70ms |
| 최대 응답시간 | 50.77ms | 39.83ms |

전체(두 시나리오 합산, 70초):

| 지표 | 값 |
|---|---|
| 총 요청 수 | 10,026 |
| 처리량 | 143.1 req/s |
| 에러율 | **0.00%** (10,026 / 10,026 성공) |
| 전체 p95 | 20.4ms |

```
✓ http_req_duration{scenario:cache_hit}: p(95)<50ms   → 실측 4.52ms
✓ http_req_duration{scenario:cache_miss}: p(95)<300ms → 실측 21.77ms
✓ http_req_failed: rate<0.01                          → 실측 0.00%
```

### 3.3 병목 분석

- 캐시 HIT과 MISS의 p95 차이는 **~4.8배**(4.52ms → 21.77ms) — Phase 5에서 측정했던 단발성 curl 비교(~5.2~5.6배)와 방향이 일치. 부하 상태에서도 캐시 효과가 재현됨.
- MISS 경로의 21.77ms는 로컬 Postgres 기준이라 절대값은 작지만, 병목은 `riskFlags` 쿼리의 `include: { disclosure: { company } }` 조인 — 필터 없이 넓은 범위를 스캔할 때 이 조인 비용이 커질 걸로 예상됨. 데이터 규모가 지금(공시 249건, 리스크플래그 679건)의 100배 이상으로 커지면 `disclosure_id`/`corp_code` 인덱스만으로는 부족해질 수 있어, 그 시점엔 `riskType`/`severity` 복합 인덱스 추가를 고려해야 함 — 지금 규모에서는 불필요한 최적화라 실행하지 않음.
- 20 VU 수준에서는 Node 이벤트 루프나 Prisma 커넥션 풀이 병목이 되는 징후가 없었음(에러율 0%, p95가 VU 증가 구간에서도 안정적). 포트폴리오 스코프(워치리스트 80개, 소규모 조회 트래픽)에서는 이 이상의 동시성 테스트는 실효성이 낮다고 판단해 20 VU에서 멈춤.

## 4. OpenAPI 스펙

`openapi.yaml` (repo root) — Phase 5의 4개 엔드포인트(`/health` 포함)를 문서화. `npx swagger-cli validate openapi.yaml`로 문법 검증 통과. Phase 8 대시보드는 이 스펙을 API 계약으로 사용 (CLAUDE.md 명시 사항).

## 5. 알려진 한계 (의도적으로 남겨둠)

- 룰 기반 분류기는 문맥 의존적 오탐(예: 일반적 회계정책 조항의 "소송" 언급)을 일부 놓칠 수 있음 — Claude API 크레딧 확보 시 보강 예정, 코드는 현재 구조 유지.
- API 키 비교는 `!==` — 타이밍 공격 방어(`crypto.timingSafeEqual`) 없음. 포트폴리오 스코프에서 의도적으로 생략.
- 레이트리밋 없음 — CLAUDE.md 요구사항 아님.
