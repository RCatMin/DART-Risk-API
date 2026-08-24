# Phase 4 작업 로그 — BullMQ 전환, 재시도·백오프, dead-letter

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 4 / 7
- **date**: 2026-08-24

지금까지 사람이 직접 `npm run seed:watchlist` → `collect:disclosures` → `extract:texts` → `classify:risks`를 순서대로 실행하던 파이프라인을, Redis 기반 BullMQ 큐 3개로 나누고 재시도·백오프·dead-letter 처리를 추가했습니다.

## 요약

| 항목 | 값 |
|---|---|
| 변경된 파일 | 12개 |
| 새로 만든 파일 | 9개 (큐/워커/프로세서 7개 + 진입 스크립트 2개) |
| 삭제된 파일 | 3개 (기존 수동 루프 스크립트, 큐로 대체) |
| 새 인프라 | 로컬 Redis (Homebrew) |
| 새 패키지 | `bullmq`, `ioredis` |
| self-review 중 발견·수정한 버그 | 1건 (워커 프로세스 크래시) |

## 사전 준비

- Homebrew로 로컬 Redis 설치 + `brew services start redis`, `.env`의 `REDIS_URL` 채움
- `bullmq`, `ioredis` 설치 (`msgpackr-extract`의 네이티브 가속 옵션 설치 스크립트는 순수 JS fallback으로 충분해 승인하지 않음)

## 새로 만든 파일

### `src/queue/connection.ts` (6줄)
BullMQ용 공용 Redis 연결. `maxRetriesPerRequest: null`은 BullMQ의 blocking command 요구사항.

### `src/queue/queues.ts` (47줄)
큐 3개(`collect-disclosures`, `extract-text`, `classify-risk`) + `dead-letter` 큐 정의. 재시도 정책: `attempts: 3`, `backoff: exponential, delay: 5000` (5s → 10s → 20s).

### `src/queue/dead-letter.ts` (46줄)
재시도가 전부 소진된 job을 `dead-letter` 큐로 옮기는 공용 핸들러. (아래 버그 수정 포함)

### `src/queue/processors/collect.ts` / `extract.ts` / `classify.ts` (43 / 23 / 38줄)
기존 스크립트 로직을 job 단위로 재구성. `collect` 완료 시 그 기업의 `pending` 공시마다 `extract` job을, `extract` 완료 시 `classify` job을 자동으로 enqueue — 체이닝 구조.

### `src/queue/run-workers.ts` (48줄)
워커 3개를 한 프로세스에서 실행 (collect/extract 동시성 2, classify 동시성 5). `SIGINT`/`SIGTERM`으로 정상 종료. 전역 `unhandledRejection`/`uncaughtException` 안전망 포함.

### `src/scripts/enqueue-collect.ts` (23줄) / `enqueue-test-failure.ts` (15줄)
파이프라인 진입점(워치리스트 기업마다 collect job 등록)과, 존재하지 않는 `disclosureId`로 강제 실패를 유발하는 DoD 검증용 스크립트.

## 삭제된 파일

기존 `src/scripts/collect-disclosures.ts`, `extract-texts.ts`, `classify-risks.ts`는 큐 기반 처리로 대체되어 삭제 (같은 파이프라인을 두 가지 방식으로 유지하지 않기 위함).

## self-review 중 발견한 버그 — 워커 프로세스 크래시

강제 실패 테스트 중, dead-letter 이동 자체는 성공했지만 그 다음 실행되는 후처리 콜백(공시 `status`를 `failed`로 표시)이 "레코드 없음" 예외(`P2025`)를 던졌고, 이게 안 잡혀서 **워커 프로세스 전체가 죽는** 버그를 발견했습니다. job 하나의 후처리 실패가 나머지 대기 중인 모든 job까지 멈춰버리는 심각한 문제라 바로 수정:

```diff
     if (onFinalFailure) {
-      await onFinalFailure(job);
+      try {
+        await onFinalFailure(job);
+      } catch (callbackError) {
+        console.error(`[dead-letter] ... onFinalFailure 콜백 실패:`, callbackError);
+      }
     }
```

`run-workers.ts`에 `process.on("unhandledRejection", ...)` / `process.on("uncaughtException", ...)` 전역 안전망도 추가.

## 검증

### 1. 정상 플로우
```
[collect] job 1 완료 { fetched: 3, enqueuedExtract: 0 }
[extract] job 2 완료 { textLength: 1041678 }
[classify] job 1 완료 { findings: 5 }
```
기존 회사 하나로 실제 collect 실행 → 이미 처리된 공시라 신규 추출 없음 확인. 별도로 공시 하나를 `pending`으로 되돌려 `extract`부터 강제 실행 → `classify`까지 자동 체이닝되어 리스크 플래그 5건 생성되는 것 확인.

### 2. 강제 실패 → 재시도 → dead-letter (버그 수정 전)
```
[retry] extract-text job 1 실패 (attempt 1/3)
[retry] extract-text job 1 실패 (attempt 2/3)
[dead-letter] extract-text job 1 최종 실패 (attempts=3) — dead-letter로 이동
[worker crashed — process exited with code 1]
```

### 3. 버그 수정 후 재검증
```
[retry] extract-text job 1 실패 (attempt 1/3) — 재시도 예정
[retry] extract-text job 1 실패 (attempt 2/3) — 재시도 예정
[dead-letter] extract-text job 1 최종 실패 (attempts=3) — dead-letter로 이동
[dead-letter] extract-text job 1 onFinalFailure 콜백 실패: ... (로그만, 크래시 없음)
```
Redis에 `bull:dead-letter:1` 레코드 생성 확인 (`attemptsMade: 3`). `SIGTERM`으로 워커 종료 시 exit code 0으로 정상 종료.

✅ **Phase 4 DoD 충족** — 강제로 실패시켜도 정책대로(3회, exponential backoff) 재시도 후 dead-letter 처리됨을 확인. 검증 과정에서 워커 크래시 버그를 발견·수정함 (TROUBLESHOOTING.md에 기록).

---

다음: Phase 5 (조회 REST API, API Key 인증, Redis 캐시)
