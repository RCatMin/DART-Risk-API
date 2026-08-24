# Phase 5 작업 로그 — 조회 REST API, API Key 인증, Redis 캐시

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 5 / 8
- **date**: 2026-08-24

지금까지는 데이터를 채우는 파이프라인만 있었고 외부에서 호출 가능한 API가 없었습니다. Phase 5에서 Express 서버를 세워서 워치리스트·공시·리스크플래그를 조회하는 REST API를 만들고, API 키 인증과 Redis 응답 캐시를 붙였습니다.

## 요약

| 항목 | 값 |
|---|---|
| 변경된 파일 | 4개 |
| 새로 만든 파일 | 8개 (`src/api/` 전체) |
| 새 패키지 | `express`, `@types/express` |
| 새 엔드포인트 | 4개 (`/health` + API 3종) |

## 새로 만든 파일 (`src/api/`)

### `response.ts` (16줄)
모든 응답에 `meta.disclaimer`("투자 자문이 아니라 참고용 정보")를 붙이는 공용 래퍼 `ok()`/`errorBody()`. CLAUDE.md 스코프에 고정된 요구사항이라, 라우터마다 따로 안 넣고 한 곳에서 강제.

### `middleware/auth.ts` (19줄)
`x-api-key` 헤더를 `.env`의 `API_KEY`와 비교하는 인증 미들웨어. 키가 서버에 설정 안 된 경우(500)와 클라이언트가 잘못된 키를 보낸 경우(401)를 구분.

### `middleware/cache.ts` (34줄)
Redis에 응답을 30초 TTL로 캐싱. `res.json`을 감싸서, 실제 응답이 나가는 시점에 그 내용을 캐시에 저장하는 방식(라우터 코드를 손대지 않고 미들웨어 하나로 전체 `/api`에 적용 가능). 캐시 히트/미스를 `X-Cache` 헤더로 노출.

### `routes/companies.ts` (48줄)
- `GET /api/companies?isWatched=` — 워치리스트 목록
- `GET /api/companies/:corpCode/disclosures` — 기업별 공시 목록. 각 공시에 `_count.riskFlags`를 같이 내려줘서, 대시보드(Phase 8)가 리스크 건수 보려고 매번 별도 호출 안 해도 되게 함

### `routes/disclosures.ts` (33줄)
`GET /api/disclosures/:id` — 공시 상세 + `riskFlags` 포함. `raw_text`는 최대 1MB 이상이라 기본 응답에서 빼고, `?includeRawText=true`일 때만 포함.

### `routes/riskFlags.ts` (49줄)
`GET /api/risk-flags?riskType=&severity=&corpCode=` — 리스크 플래그 필터 조회. enum 값은 요청 시점에 화이트리스트로 검증(잘못된 값은 400).

### `app.ts` (30줄)
Express 앱 조립: `/health`는 인증 없이, `/api` 하위 전체는 `requireApiKey` → `cacheResponse()` 순으로 적용. 마지막에 404 핸들러와 에러 핸들러.

## 수정된 파일

### `src/index.ts` (+8 / −1)
Phase 0의 자리표시자(`console.log` 한 줄)를 실제 서버 부트스트랩으로 교체.

```diff
-console.log("dart-risk-api: Phase 0 setup OK");
+import { createApp } from "./api/app.js";
+const port = Number(process.env.PORT) || 3000;
+const app = createApp();
+app.listen(port, () => console.log(`dart-risk-api 서버 시작: http://localhost:${port}`));
```

### `package.json` (+3 / −1)
`start` 스크립트가 `.env`를 안 읽고 있던 걸 다른 스크립트들과 통일 (`node dist/index.js` → `tsc && node --env-file=.env dist/index.js`).

### `.env.example` (+7 / −1)
`API_KEY`, `PORT` 항목 추가 (실제 키는 `.env`에 직접 생성한 랜덤 값).

## 검증

```
$ curl http://localhost:3000/health
{"status":"ok"}

$ curl http://localhost:3000/api/companies          # 인증 없음
→ 401

$ curl -H "x-api-key: ..." ".../api/risk-flags?riskType=nonsense"
→ 400 "riskType은 ... 중 하나여야 합니다."

$ curl -H "x-api-key: ..." ".../api/companies/00000000/disclosures"
→ 404 "기업을 찾을 수 없습니다."
```

### 캐시 응답시간 비교

| 엔드포인트 | MISS | HIT | 배수 |
|---|---|---|---|
| `/api/companies` | 4.2ms | 0.8ms | ~5.2x |
| `/api/risk-flags?limit=100` | 5.8ms | 1.0ms | ~5.6x |

`X-Cache: MISS` → `HIT`로 헤더가 바뀌는 것도 함께 확인. Redis TTL(30초) 만료 후 재요청하면 다시 MISS로 돌아옴.

✅ **Phase 5 DoD 충족** — 캐시 적용 전/후 응답시간 차이를 실측으로 확인.

## self-review

- `raw_text`(1MB+)는 옵트인으로만 응답에 포함 — 기본 페이로드를 가볍게 유지
- API 키 비교는 단순 `!==` — 포트폴리오 스코프라 타이밍 공격 방어(`crypto.timingSafeEqual`)는 생략한 알고 있는 단순화
- Express 5는 async 라우터 핸들러의 reject를 자동으로 에러 미들웨어에 전달 — 라우터마다 try/catch를 안 붙여도 안전 (Express 4와 달라진 부분)
- 레이트리밋/어뷰징 방지는 아직 없음 — CLAUDE.md에 명시된 요구사항이 아니라 이번 Phase에는 추가하지 않음

---

다음: Phase 6 (구조화 로깅, job 실행 로그)
