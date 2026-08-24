# CODE_GUIDE — 파일별 역할과 설계 이유

Phase 0~4까지 만들어진 모든 코드를 파일 단위로 훑습니다. "이 파일이 뭘 하는지"와 "왜 이렇게 짰는지"를 같이 적었습니다. `src/generated/prisma/`는 Prisma가 자동 생성한 코드라 제외했습니다.

## 전체 그림

```
data.go.kr (시가총액)  ─┐
                        ├──▶ seed-watchlist.ts ──▶ Company 테이블 (워치리스트 79개)
DART corpCode.xml     ──┘

DART list.json  ──▶ [collect] job ──▶ Disclosure 테이블 (신규 공시, dedup)
                          │
                          ▼ (자동 체이닝)
DART document.xml ──▶ [extract] job ──▶ Disclosure.raw_text, status='done'
                          │
                          ▼ (자동 체이닝)
룰 기반 키워드 매칭 ──▶ [classify] job ──▶ RiskFlag 테이블

3회 재시도 실패 ──▶ dead-letter 큐
```

지금까지 만든 건 전부 **데이터를 채우는 파이프라인**이고, 이걸 API로 꺼내 보여주는 부분(Phase 5)과 화면(Phase 8)은 아직 없습니다.

## 디렉터리 구조

```
prisma/schema.prisma      DB 스키마 (Company, Disclosure, RiskFlag)
src/
  index.ts                Phase 0 때 만든 빌드 확인용 자리표시자 (아직 실제 역할 없음)
  lib/
    prisma.ts             Prisma Client 싱글턴
    zip.ts                zip 다운로드/해제 공용 유틸
  dart/
    corpCode.ts           DART 고유번호(corp_code) ↔ 종목코드 매핑
    disclosures.ts         공시목록 조회 (list.json)
    document.ts            공시원문 텍스트 추출 (document.xml)
  marketcap/
    dataGoKr.ts            시가총액 순위 조회 (data.go.kr)
  risk/
    rules.ts               키워드+부정문 감지 리스크 판정 엔진
  queue/
    connection.ts          Redis 연결
    queues.ts              큐 3개 + dead-letter 큐 정의, 재시도 정책
    dead-letter.ts          재시도 소진 job → dead-letter 이동 핸들러
    run-workers.ts          워커 3개 실행 진입점
    processors/
      collect.ts            collect job 처리 로직
      extract.ts             extract job 처리 로직
      classify.ts            classify job 처리 로직
  scripts/
    seed-watchlist.ts        워치리스트 시딩 (1회성 실행)
    enqueue-collect.ts        파이프라인 진입점 (기업별 collect job 등록)
    enqueue-test-failure.ts   강제 실패 테스트용
```

---

## `prisma/schema.prisma`

**역할**: DB 스키마 전체. `Company`(워치리스트 종목), `Disclosure`(공시), `RiskFlag`(리스크 판정 결과) 3개 모델과 관련 enum.

**왜 이렇게 짰는지**

- `generator client`의 `output`을 기본값(`../generated/prisma`)이 아니라 `../src/generated/prisma`로 바꿨습니다. `tsconfig.json`의 `rootDir`가 `./src`로 고정돼 있어서, 생성된 클라이언트가 `src` 바깥에 있으면 빌드가 깨졌기 때문입니다 (Phase 1에서 발견).
- 모든 필드에 `@map`으로 snake_case DB 컬럼명을 지정했습니다. Prisma Client에서는 camelCase(`corpCode`)로 쓰고 싶은데, DART API가 주는 원본 필드명은 snake_case(`corp_code`)라 둘을 맞추는 관례입니다.
- `Company.corpCode`를 자체 PK로 씀 — DART가 부여하는 8자리 고유번호가 이미 안정적인 자연키라 별도 surrogate id가 필요 없었습니다.
- `Disclosure.rceptNo`에 `@unique` — "재실행해도 중복 안 생김"(Phase 1 DoD)을 애플리케이션 코드가 아니라 **DB 제약으로 보장**하기 위함. `createMany({ skipDuplicates: true })`가 이 제약에 기대어 동작합니다.
- `RiskFlag`는 `disclosureId` 하나에 여러 행이 붙을 수 있는 구조 — 공시 하나에서 "소송"과 "배임"이 동시에 잡히는 경우가 실제로 있어서, 1:N이 맞는 모델링입니다.
- `RiskType` enum의 5개 값은 CLAUDE.md에 고정된 리스크 유형과 1:1로 맞춰뒀습니다(임의로 늘리지 않음).

---

## `src/lib/prisma.ts` (6줄)

**역할**: 프로젝트 전체에서 공유하는 Prisma Client 싱글턴.

**왜 이렇게 짰는지**: Prisma 7부터는 클라이언트가 자체 접속 엔진 없이 **드라이버 어댑터**를 통해서만 DB에 붙습니다. 그래서 `new PrismaClient({ url })` 같은 옛 방식이 아니라 `@prisma/adapter-pg`의 `PrismaPg`에 `DATABASE_URL`을 넘겨 어댑터를 만들고, 그걸 클라이언트에 주입하는 구조입니다. 이 파일 하나로 앱 전역이 같은 커넥션 풀을 씁니다.

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

---

## `src/lib/zip.ts` (28줄)

**역할**: zip 버퍼를 받아서 임시 디렉터리에 풀고, 안의 모든 파일을 UTF-8 텍스트로 읽어 반환하는 공용 함수 `unzipToText()`.

**왜 이렇게 짰는지**: DART API 중 `corpCode.xml`(Phase 1)과 `document.xml`(Phase 2) 둘 다 응답이 zip이라, 처음엔 각자 따로 압축 해제 코드를 넣었다가(Phase 1) Phase 2에서 중복이 보여서 공용 유틸로 뺐습니다(그 결과 `corpCode.ts`가 13줄 늘고 26줄이 줄어드는 리팩터링이 있었습니다). Node에 zip 해제 기능이 기본으로 없어서, 별도 npm 패키지를 추가하는 대신 macOS/Linux에 이미 있는 `unzip` CLI를 `execFileSync`로 호출합니다 — 배열 인자로 넘겨서 셸 인젝션 위험 없이. 응답이 zip이 아니라 에러 XML일 수도 있어서, 맨 앞 2바이트가 zip 시그니처("PK")인지부터 확인하고 아니면 바로 에러 메시지를 보여줍니다.

---

## `src/dart/corpCode.ts` (42줄)

**역할**: DART가 주는 전체 기업 목록(zip 안의 `CORPCODE.xml`)을 받아 `종목코드 → { corp_code, corp_name }` 조회 테이블(Map)을 만듭니다.

**왜 이렇게 짰는지**: DART API에는 "이 종목코드의 corp_code가 뭐야?"라고 물어보는 API가 없습니다. corp_code를 알아내는 유일한 방법이 전체 목록(수만 개 기업)을 통째로 받는 것뿐이라, 어쩔 수 없이 전체를 받아 로컬에서 매핑합니다. XML 파싱은 정규식으로 했습니다 — `<list>...</list>` 블록 단위로 잘라서 그 안의 태그들을 각각 정규식으로 뽑는 방식인데, 신뢰할 수 있는 공식 소스에서 오는 고정된 포맷이라 별도 XML 파서 라이브러리를 추가하지 않고 이 방식으로 충분하다고 판단했습니다. 기업명에 `&`, `<` 같은 문자가 XML 엔티티(`&amp;` 등)로 들어올 수 있어서 `decodeXmlEntities()`로 복원합니다.

---

## `src/dart/disclosures.ts` (65줄)

**역할**: 기업 하나(`corp_code`)의 기간별 공시목록을 DART `list.json`으로 조회하고, `report_nm`에 "사업보고서" 또는 "감사보고서"가 포함된 것만 걸러서 반환.

**왜 이렇게 짰는지**: DART `list.json`은 페이지네이션이 있어서(`page_no`, `page_count`), 응답 건수가 요청한 `page_count`보다 적을 때까지 반복 호출합니다. 응답의 `status` 필드로 성공/실패/데이터없음(`013`)을 구분해서, `013`은 정상적인 "그냥 없음"으로 조용히 종료하고 그 외 에러 코드는 예외를 던집니다. 리포트 타입 필터링을 DART의 공식 분류 코드(`pblntf_detail_ty`)가 아니라 **`report_nm` 문자열 포함 검사**로 한 이유는, 사업보고서/감사보고서 각각이 정정·첨부정정 등 다양한 변형된 이름으로 오는데 문자열 매칭이 이런 변형을 전부 자연스럽게 잡아주기 때문입니다(대신 Phase 3에서 확인했듯, "해외증권거래소등에신고한사업보고서" 같은 다소 느슨하게 걸리는 것도 같이 잡힙니다 — 알고 있는 트레이드오프).

---

## `src/dart/document.ts` (53줄)

**역할**: 공시 하나(`rcept_no`)의 원문 zip을 받아, 그 안에서 원하는 문서(사업보고서 또는 감사보고서)만 골라 태그를 제거한 평문 텍스트로 변환.

**왜 이렇게 짰는지**: 사전에 삼성전자 사업보고서 하나를 실제로 받아보고서야 알게 된 사실인데, 공시 하나의 zip 안에는 본문 하나만 있는 게 아니라 첨부된 감사보고서·연결감사보고서까지 여러 XML 파일이 같이 들어있습니다. 그래서 각 파일의 `<DOCUMENT-NAME>` 태그를 읽어서 `report_nm`과 같은 종류의 문서만 고르고, 후보가 여럿이면(별도/연결 감사보고서처럼) 본문이 더 긴 쪽을 채택합니다. 태그 제거는 `<[^>]+>`를 전부 `\n`으로 치환하는 방식인데, 이 덕분에 표(`<TABLE><TR><TD>`) 구조가 자연스럽게 한 줄씩으로 풀리고, 이 "한 줄 단위"가 나중에 `rules.ts`에서 리스크 문구를 잘라내는 경계로 그대로 재활용됩니다(두 파일이 이렇게 암묵적으로 연결돼 있습니다).

---

## `src/marketcap/dataGoKr.ts` (71줄)

**역할**: 공공데이터포털의 "금융위원회_주식시세정보" API로 코스피/코스닥 시가총액 순위를 조회해서 상위 N개를 반환.

**왜 이렇게 짰는지**:
- 시세 데이터가 기준일 다음 영업일 오후에나 갱신되기 때문에, 오늘 날짜로 조회했을 때 비어있으면 최대 7일 전까지 하루씩 거슬러 올라가며 재시도합니다.
- data.go.kr 서비스키는 발급 시점에 **이미 URL 인코딩된 형태**(`%2B`, `%3D%3D` 포함)로 나옵니다. 이걸 그대로 `URLSearchParams.set()`에 넣으면 `%` 문자가 다시 한번 인코딩되어(`%2B` → `%252B`) 인증이 깨지는 걸 실제로 겪었습니다 — 그래서 넘기기 전에 `decodeURIComponent()`로 한 번 풀어서 원본 값을 복원합니다. 이렇게 하면 사용자가 인코딩된 키/원본 키 중 뭘 `.env`에 넣어도 안전합니다.
- 응답의 `header.resultCode`가 `"00"`이 아니면 바로 에러를 던져서, 키가 잘못됐거나 요청이 틀렸을 때 조용히 빈 배열을 반환하는 대신 원인이 드러나게 했습니다.

---

## `src/risk/rules.ts` (103줄)

**역할**: 공시 본문 텍스트에서 키워드로 4가지 리스크 유형(감사의견 비적정/횡령·배임/소송/관리종목 지정)을 찾아내는 규칙 엔진.

**왜 이렇게 짰는지 (가장 많이 시행착오를 겪은 파일)**

원래 계획은 "키워드 필터 + Claude API 판단"이었는데, API 크레딧을 확보하지 못해 규칙만으로 판단하도록 방향을 바꿨습니다(사용자 명시적 결정, CLAUDE.md에 기록). 이 파일은 그 결과물이고, 아래 4개의 방어 장치가 전부 **실제로 오탐을 겪고 나서** 하나씩 추가된 것들입니다.

1. **부정문 감지** (`hasNegationNearby`) — 사업보고서는 법정 필수 기재 항목이라 "소송: 해당사항 없습니다" 식으로 키워드를 언급만 하고 부정하는 문장이 太반입니다. 매칭 지점 ±40자 안에 "없습니다/해당없음/전무" 등이 있으면 버립니다.
2. **최소 길이 40자** (`MIN_SNIPPET_LENGTH`) — 재무제표 주석의 "소송충당부채", "주요 소송 금액" 같은 **표 항목 라벨**이 실제 서술문처럼 한 줄씩 걸려서 처음엔 한 문서에서 소송이 78건씩 잡히는 사고가 있었습니다. 라벨은 대부분 짧아서 길이로 걸러냅니다.
3. **문서당 유형별 최대 5건** (`MAX_FINDINGS_PER_TYPE`) — 그래도 자회사가 많은 대기업은 비슷한 문장이 반복되므로, 길이가 긴(=서술적인) 것 위주로 최대 5개만 남깁니다.
4. **숫자+"배임" 예외 처리** (`isFalsePositiveMatch`) — "충전시간이 약 5**배임**을 감안할 경우"(5배+이다)처럼, "배임"이라는 두 글자가 완전히 무관한 문장에 우연히 등장하는 걸 실제로 발견했습니다. 숫자 바로 뒤에 오는 "배임"은 제외합니다.
5. **교육 안내문 제외** (`BOILERPLATE_MARKERS`) — "영업비밀보호법 위반, 횡령, 배임... 예방 **교육**"처럼 준법교육 커리큘럼을 나열하는 문장도 실제 사건처럼 걸려서, "교육"/"가이드라인"이 포함된 스니펫은 제외합니다.

이렇게 고치고도 10건 수동 검증에서 "회계정책 문구에 키워드가 우연히 포함된 경우"(예: "소송에 패소한 경우 대손 처리한다"는 일반 조항)까지는 걸러내지 못하는 한계가 남아있습니다. 이건 순수 규칙이 아니라 문맥을 이해해야 하는 판단이라, Claude API가 맡았어야 할 역할입니다.

---

## `src/queue/connection.ts` (6줄)

**역할**: BullMQ가 쓰는 공용 Redis 연결(ioredis 인스턴스) 하나.

**왜 이렇게 짰는지**: `maxRetriesPerRequest: null`을 반드시 줘야 합니다 — BullMQ가 내부적으로 blocking command(`BRPOPLPUSH` 등)를 쓰는데, ioredis 기본값(재시도 횟수 제한)이 걸려있으면 이 명령이 중간에 실패할 수 있어서 BullMQ 공식 요구사항입니다.

---

## `src/queue/queues.ts` (47줄)

**역할**: 큐 3개(`collect-disclosures`, `extract-text`, `classify-risk`)와 `dead-letter` 큐를 정의하고, 모든 job에 적용될 기본 재시도 정책을 설정.

**왜 이렇게 짰는지**: `attempts: 3` + `backoff: exponential, delay: 5000`(5s→10s→20s)으로 정했습니다. DART API가 순간적인 네트워크 오류나 rate limit으로 실패할 가능성을 감안한 값으로, CLAUDE.md에 구체적 수치가 없어 직접 정한 값입니다. `removeOnFail: false`로 실패한 job을 지우지 않고 남겨두는데, dead-letter 판단 로직(`attemptsMade`)이 실패 job 정보를 참조하기 때문입니다.

---

## `src/queue/dead-letter.ts` (46줄)

**역할**: 워커의 `failed` 이벤트를 받아서, 재시도가 다 소진됐으면 그 job을 `dead-letter` 큐로 옮기는 공용 핸들러.

**왜 이렇게 짰는지**: `job.attemptsMade >= job.opts.attempts`면 "이게 마지막 시도였다"고 판단합니다. 원래는 dead-letter 기록과 `onFinalFailure` 콜백 호출을 그냥 순서대로 `await`만 했는데, 강제 실패 테스트 중 **콜백이 던진 예외가 안 잡혀서 워커 프로세스 전체가 죽는 사고**를 실제로 겪었습니다(TROUBLESHOOTING.md 참고). 그래서 두 블록을 각각 try/catch로 감쌌습니다 — "job 하나의 최종 실패 처리"가 또 실패하더라도, 그게 다른 대기 중인 job들까지 멈추게 하면 안 되기 때문입니다.

---

## `src/queue/run-workers.ts` (48줄)

**역할**: 워커 3개를 한 프로세스에서 띄우는 진입점. `npm run workers`로 실행하는 장기 실행 프로세스.

**왜 이렇게 짰는지**: DART API를 호출하는 `collect`/`extract`는 동시성을 2로 낮게, 순수 로컬 연산인 `classify`는 5로 높게 뒀습니다 — 외부 API에 과도한 동시 요청을 보내지 않으면서 로컬 처리는 병목 없이 돌리려는 의도입니다. `SIGINT`/`SIGTERM`을 받으면 워커들을 `close()`한 뒤 정상 종료하도록 했고, `dead-letter.ts` 버그를 겪은 뒤로 `unhandledRejection`/`uncaughtException` 전역 리스너를 추가해서 예상 못한 예외 하나가 프로세스를 죽이는 걸 한 번 더 방어합니다.

---

## `src/queue/processors/collect.ts` (43줄)

**역할**: `collect` job 하나 = 기업 하나. 그 기업의 최근 1년 공시목록을 DART에서 받아 `createMany({ skipDuplicates: true })`로 저장하고, 아직 텍스트 추출 전(`status: pending`)인 공시마다 `extract` job을 자동으로 등록.

**왜 이렇게 짰는지**: "새로 들어온 것만" 체이닝하는 게 아니라 "이 기업의 pending 상태 전체"를 다시 조회해서 체이닝합니다. 이렇게 하면 이전에 수집됐지만 무슨 이유로 아직 추출 안 된 공시(예: 이전 실행에서 워커가 꺼져있었던 경우)도 자동으로 다시 챙겨지고, 로직이 "새 것/헌 것" 구분 없이 훨씬 단순해집니다.

---

## `src/queue/processors/extract.ts` (23줄)

**역할**: `extract` job 하나 = 공시 하나. 원문 텍스트를 뽑아 `raw_text`/`status='done'`으로 갱신하고, `classify` job을 자동 등록.

**왜 이렇게 짰는지**: 처리 시작 시 `status`를 먼저 `processing`으로 바꿔둡니다 — 이 job이 지금 어느 상태인지 DB만 보고도 알 수 있게 하기 위함(재시도 중인지, 아예 시작 안 했는지 구분). 최종 실패 시 `status`를 `failed`로 바꾸는 건 이 파일이 아니라 `run-workers.ts`에서 `attachDeadLetterHandler`에 넘기는 콜백이 담당합니다 — "몇 번째 시도인지/최종 실패인지" 판단은 BullMQ 쪽 정보(`attemptsMade`)가 필요해서, 그 판단이 이미 끝난 dead-letter 핸들러 쪽에 두는 게 더 자연스러웠습니다.

---

## `src/queue/processors/classify.ts` (38줄)

**역할**: `classify` job 하나 = 공시 하나. `rules.ts`로 판정하고, 결과가 있으면 `RiskFlag`를 생성, 없으면 `not_applicable` 플래그 하나로 "처리 완료, 리스크 없음"을 표시.

**왜 이렇게 짰는지**: 이 처리 자체는 별도의 재시도 안전장치 없이도 안전합니다 — `createMany()`가 단일 쿼리라 DB 트랜잭션 단위로 전부 성공하거나 전부 실패하고, 만약 job이 재시도되더라도 (극히 드문 중간 실패가 아니라면) 부분적으로 겹쳐 쓰이는 상황이 거의 생기지 않는 구조입니다.

---

## `src/scripts/seed-watchlist.ts` (44줄)

**역할**: `data.go.kr` 시가총액 상위 80개 + DART corp_code 매핑을 조합해서 `Company` 테이블에 워치리스트를 시딩하는 1회성 스크립트.

**왜 이렇게 짰는지**: 큐로 만들지 않고 그냥 스크립트로 남겨뒀습니다 — 워치리스트를 다시 뽑는 일은 매일 도는 파이프라인이 아니라 가끔(예: 분기마다) 사람이 판단해서 실행하는 성격의 작업이라, job으로 만들 이유가 없었습니다. `upsert`를 써서 이미 있는 기업은 `isWatched: true`로만 갱신하고 중복 생성하지 않습니다.

---

## `src/scripts/enqueue-collect.ts` (23줄)

**역할**: 워치리스트 기업마다 `collect` job을 큐에 등록하는, 파이프라인의 실제 진입점.

**왜 이렇게 짰는지**: "job을 만드는 것"(producer)과 "job을 처리하는 것"(worker, `run-workers.ts`)을 분리했습니다 — 실제 운영에서는 이 producer를 cron으로 매일 돌리고, worker는 항상 켜져 있는 별도 프로세스로 두는 구조가 되어야 하기 때문입니다. Redis에 job만 넣고 나면 이 스크립트는 바로 종료해야 하므로, 끝나면 `process.exit()`을 명시적으로 호출합니다 (호출 안 하면 열려있는 Redis 연결 때문에 프로세스가 안 끝납니다).

---

## `src/scripts/enqueue-test-failure.ts` (15줄)

**역할**: 존재하지 않는 `disclosureId`로 `extract` job을 하나 넣어서, 재시도·dead-letter 정책을 강제로 검증하는 테스트 스크립트.

**왜 이렇게 짰는지**: Phase 4 DoD("강제로 실패시켜도...")를 검증하려면 확실하게, 매번 똑같이 실패하는 job이 필요했습니다. 네트워크 오류 같은 건 재현이 불안정해서, "DB에 없는 ID"라는 100% 결정적으로 실패하는 조건을 택했습니다.

---

## `src/index.ts` (1줄)

**역할**: 지금은 `console.log("dart-risk-api: Phase 0 setup OK")` 한 줄뿐인, Phase 0 빌드 확인용 자리표시자입니다.

**앞으로**: Phase 5에서 Express(또는 Fastify) 서버 엔트리포인트로 교체될 자리입니다. 지금은 이 프로젝트에 아직 "떠 있는 서버"가 없다는 뜻이기도 합니다 — 지금까지 만든 건 전부 배치/큐 파이프라인이고, 외부에서 호출 가능한 API는 아직 없습니다.
