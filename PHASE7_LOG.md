# Phase 7 작업 로그 — k6 부하 테스트, OpenAPI 스펙, 설계 문서

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 7 / 8
- **date**: 2026-08-24

Phase 5~6에서 만든 조회 API를 실제로 부하를 걸어 검증하고, Phase 8 대시보드가 쓸 API 계약(OpenAPI)과 지금까지의 아키텍처를 정리한 설계 문서를 남겼다.

## 요약

| 항목 | 값 |
|---|---|
| 새 도구 | k6 (Homebrew) |
| 새로 만든 파일 | 3개 (`k6/load-test.js`, `openapi.yaml`, `DESIGN.md`) |
| 수정된 파일 | 1개 (`package.json` — `loadtest` 스크립트) |
| 부하 테스트 총 요청 | 10,026건 / 70초 |
| 에러율 | 0.00% |

## 새로 만든 파일

### `k6/load-test.js`
`cache_hit`(항상 같은 쿼리) / `cache_miss`(매번 고유한 offset) 두 시나리오를 시간을 나눠 실행. 각 0→20 VU ramping, 35초씩 총 70초. `API_KEY`/`BASE_URL`은 하드코딩하지 않고 `__ENV`로 주입.

### `openapi.yaml`
Phase 5의 5개 엔드포인트(`/health` 포함) 전체 문서화 — 파라미터, 응답 스키마, 인증(`x-api-key`), 에러 응답(400/401/404). `npx swagger-cli validate`로 문법 검증 통과.

### `DESIGN.md`
전체 아키텍처(수집→추출→분류 파이프라인, 큐/재시도, 캐시 전략, 로깅), 캐시 키 설계의 함의, k6 결과와 병목 분석, 알려진 한계를 정리.

## 수정된 파일

### `package.json`
```diff
+"loadtest": "set -a && . ./.env && set +a && k6 run -e API_KEY=\"$API_KEY\" -e BASE_URL=\"http://localhost:${PORT:-3000}\" -e CORP_CODE=00126380 k6/load-test.js",
```
k6는 npm 패키지가 아니라 별도 바이너리라 `--env-file`을 못 씀 — `.env`를 셸에서 직접 source해서 `API_KEY`를 k6에 전달.

## 검증 — k6 결과

| 지표 | cache_hit (동일 쿼리) | cache_miss (매번 고유 offset) |
|---|---|---|
| X-Cache 비율 | HIT 99.7% | MISS 100% |
| p95 응답시간 | **4.52ms** | **21.77ms** |
| 평균 응답시간 | 2.51ms | 15.70ms |

**전체 70초**: 총 10,026 요청, 처리량 143.1 req/s, **에러율 0.00%**, 전체 p95 20.4ms.

```
✓ http_req_duration{scenario:cache_hit}: p(95)<50ms   → 실측 4.52ms
✓ http_req_duration{scenario:cache_miss}: p(95)<300ms → 실측 21.77ms
✓ http_req_failed: rate<0.01                          → 실측 0.00%
```

✅ **Phase 7 DoD 충족** — p95/처리량/에러율 리포트 산출 완료.

## self-review / 트러블슈팅

- **포트 3000 충돌**: 첫 실행에서 k6가 전부 404(HTML)를 받아서 원인 파악 중 발견 — 이 프로젝트와 무관한 다른 Next.js 프로세스가 이미 `127.0.0.1:3000`(IPv4)을 점유하고 있었고, 이 서버는 `*:3000`(IPv6)으로 떠서 `curl localhost`는 우연히 IPv6로 붙어 정상 응답, k6는 IPv4로 붙어 엉뚱한 서버를 때린 것. 다른 프로세스는 건드리지 않고 이번 테스트만 포트 3001로 띄워서 해결 — 코드 버그 아님, 로컬 환경 문제.
- **캐시 미스 시나리오 설계 오류**: 처음에 `offset`을 0~500 난수로 생성했는데, 초당 100건 이상의 요청량 대비 난수 공간이 좁아서 30초 TTL 안에 같은 offset이 반복되어 "미스 시나리오"인데도 90%가 HIT로 나옴. `offset = __VU * 100000 + __ITER`로 전체 실행에서 절대 중복 없게 수정 후 의도한 100% MISS 확인.
- 부하 테스트는 `NODE_ENV=production`으로 띄워서 pino-pretty 오버헤드 없이 순수 JSON 로그로 측정 — 개발용 pretty 출력이 부하 테스트 결과를 왜곡하지 않도록 함.
- 20 VU 이상으로 올리지 않은 이유: 워치리스트 80개 기업 규모의 포트폴리오 스코프에서 그 이상의 동시성은 실사용 시나리오를 벗어난다고 판단.

---

다음: Phase 8 (React + Vite 대시보드)
