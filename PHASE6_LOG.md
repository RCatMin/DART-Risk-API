# Phase 6 작업 로그 — 구조화 로깅, job 실행 로그

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 6 / 8
- **date**: 2026-08-24

지금까지는 워커/서버 모두 `console.log`/`console.error`로 텍스트 로그만 남기고 있어서, job이 실패했을 때 원인을 파악하려면 코드를 봐야 했습니다. Phase 6에서는 `pino` 기반 구조화 로깅으로 전환하고, job 실행 이력을 DB(`JobLog`)에도 남겨서 로그/DB만 보고 실패 원인을 진단할 수 있게 했습니다. 범위는 job 로깅 + API 요청 로깅 둘 다로 정했습니다.

## 요약

| 항목 | 값 |
|---|---|
| 새 패키지 | `pino`, `pino-http` (runtime), `pino-pretty` (dev) |
| 새로 만든 파일 | 2개 (`src/lib/logger.ts`, `src/queue/instrument.ts`) |
| 새 Prisma 모델 | `JobLog` (+ `JobStatus` enum) |
| 수정된 파일 | 6개 |

## 새로 만든 파일

### `src/lib/logger.ts`
전역 pino 인스턴스. `NODE_ENV=production`이면 순수 JSON(로그 수집기용), 그 외에는 `pino-pretty`로 터미널에서 보기 좋게 출력. 워커/API 양쪽에서 이 인스턴스를 공유.

### `src/queue/instrument.ts` — `withJobLog(jobType, processor)`
큐 프로세서를 감싸는 고차 함수. 각 시도(재시도 포함)마다:
1. 시작 시 구조화 로그(`job 시작`)
2. 실행 후 소요시간(`durationMs`) 계산
3. **성공/실패와 무관하게** `JobLog` 테이블에 `{jobId, jobType, status, durationMs, errorMessage}` 기록

`src/queue/run-workers.ts`에서 3개 프로세서(`collect`/`extract`/`classify`)를 모두 이 함수로 감싸서 적용.

## 수정된 파일

### `prisma/schema.prisma` (+18)
CLAUDE.md 데이터 모델 초안에 있던 `JobLog`를 실제로 추가 (`job_id`, `job_type`, `status`, `duration_ms`, `error_message`). 마이그레이션: `20260824064310_add_job_log`.

### `src/queue/run-workers.ts`
- 3개 워커 생성 시 processor를 `withJobLog(...)`로 감쌈
- `console.log`/`console.error` → `logger.info`/`logger.error`로 교체 (워커 시작/종료, completed 이벤트, 전역 예외 핸들러)

### `src/queue/dead-letter.ts`
`console.warn`/`console.error` → `logger.child({ queueName })` 기반 구조화 로그로 교체. 재시도 예정/최종 실패/dead-letter 기록 실패/콜백 실패 각각 필드(jobId, attemptsMade, err)를 구조화해서 남김.

### `src/api/app.ts` (+17)
- `pino-http` 미들웨어 추가 — 모든 요청의 method/path/status/응답시간을 구조화 로그로 남김. `/health`는 자주 호출돼 로그가 묻히므로 제외.
- 에러 핸들러의 `console.error` → `req.log.error`로 교체 (요청 컨텍스트가 같이 남음)

### `src/index.ts`
서버 시작 로그를 `console.log` → `logger.info`로 교체.

### `.env.example`
`NODE_ENV=development` 추가 — production일 때만 JSON, 그 외엔 pino-pretty.

## 검증

### 1. API 요청 로깅 + API 키 마스킹

```
$ curl -H "x-api-key: ..." "http://localhost:3000/api/companies"
```

```json
"headers": {
  "host": "localhost:3000",
  "user-agent": "curl/8.7.1",
  "accept": "*/*",
  "x-api-key": "***"
},
"res": { "statusCode": 200, ... },
"responseTime": 74
```

`/health`는 로그에 안 남는 것도 함께 확인.

⚠️ **self-review 중 발견한 문제**: 처음에는 `x-api-key` 헤더 값이 로그에 평문으로 그대로 찍혔음 (`"x-api-key": "95c413655c..."`). API 키가 그대로 로그 파일에 남는 건 보안 문제라, `pino-http`의 `redact` 옵션으로 즉시 마스킹 처리.

### 2. job 실행 로그 + JobLog (Phase 4 강제 실패 스크립트 재사용)

```
$ node dist/scripts/enqueue-test-failure.js
강제 실패 테스트 job 등록: id=4
```

20초 후 (재시도 3회 완료) DB만 조회:

```js
> prisma.jobLog.findMany({ where: { jobId: "4" } })
[
  { id: 4, status: 'failed', durationMs: 53 },
  { id: 5, status: 'failed', durationMs: 5 },
  { id: 6, status: 'failed', durationMs: 16 }
]
```

코드를 보지 않고 로그(`[extract] job 실패 — attemptsMade, err.message, err.code: P2025`)와 위 테이블만으로 "job 4가 존재하지 않는 disclosureId를 조회하다 3번 재시도 후 최종 실패했다"는 걸 파악 가능.

✅ **Phase 6 DoD 충족** — 실패 job의 원인을 로그만 보고 파악 가능.

## self-review

- **버그 발견 및 수정**: `withJobLog`에서 처음에는 성공 시 `JobLog` 기록을 try 블록 안에서 실행 로직과 같이 감싸고 있어서, JobLog 기록 자체가 실패(예: DB 순단)하면 **정상적으로 끝난 job이 실패로 오인되어 재시도**되는 버그가 있었음. job 실행과 JobLog 기록을 분리하고, 기록 실패는 로그만 남기고 job 결과에 영향 없도록 수정.
- API 키 마스킹(위 검증 섹션) — 실제로 잡아서 고친 보안 이슈.
- `JobLog`는 시도마다(재시도 포함) 기록되고, dead-letter 큐 이동은 최종 실패 시에만 별도로 기록됨 — 두 로그의 목적이 다름(시도별 타임라인 vs 최종 처리 결과)을 의도적으로 유지.
- CLI 스크립트(`seed-watchlist`, `enqueue-*`)는 사람이 직접 실행하는 일회성 도구라 `console.log`를 그대로 유지 — 구조화 로깅 대상은 워커/서버 상시 프로세스로 한정.

---

다음: Phase 7 (k6 부하 테스트 + OpenAPI 스펙 + 설계 문서)
