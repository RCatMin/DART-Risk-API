# Phase 1 작업 로그 — 워치리스트 시딩 & 공시 수집 파이프라인

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 1 / 7
- **date**: 2026-08-19

Prisma 스키마 설계부터 시가총액 상위 종목 시딩, DART 공시목록 연동, 중복 방지 검증까지 이번 세션에서 손댄 파일을 변경 유형별로 정리했습니다.

## 요약

| 항목 | 값 |
|---|---|
| 변경된 파일 | 13개 |
| 새로 만든 파일 | 8개 |
| 추가된 줄 (락파일 제외) | +403 |
| 삭제된 줄 | −3 |

## 새로 만든 파일

### `prisma/migrations/20260819053359_init/`
최초 마이그레이션. `companies`, `disclosures` 테이블과 `DisclosureStatus` enum을 로컬 PostgreSQL에 실제로 적용한 이력.

### `src/lib/prisma.ts` (6줄)
Prisma 7 클라이언트 싱글턴. 엔진 바이너리 대신 `@prisma/adapter-pg` + `pg` 드라이버로 `DATABASE_URL`에 연결한다.

### `src/dart/corpCode.ts` (56줄)
DART `corpCode.xml`(zip)을 내려받아 `unzip`으로 풀고 정규식으로 파싱해 `stock_code → corp_code` 조회 테이블을 만든다. 종목코드만으로는 DART 고유번호를 알 수 없어서, 전체 목록을 받아 로컬에서 매핑하는 방식을 택했다.

### `src/marketcap/dataGoKr.ts` (71줄)
공공데이터포털 `getStockPriceInfo` API로 코스피·코스닥 시가총액 순위를 조회. 기준일 데이터가 아직 갱신 전일 수 있어 최근 7일까지 거슬러 재시도한다.

> **주의**: data.go.kr 서비스키는 발급 시점에 이미 URL 인코딩되어 있어, 요청 직전 `decodeURIComponent`로 한 번 풀어준 뒤 넘긴다 (이중 인코딩 방지).

### `src/dart/disclosures.ts` (65줄)
기업별 `list.json`을 페이지네이션으로 순회하며 `report_nm`에 "사업보고서" 또는 "감사보고서"가 포함된 공시만 추린다.

> **알려진 한계**: 문자열 포함 매칭이라 "감사보고서제출(자회사의 주요경영사항)"처럼 느슨하게 걸리는 항목이 섞인다 — 정밀 필터링은 Phase 3 범위로 남겨둠.

### `src/scripts/seed-watchlist.ts` (44줄)
시가총액 상위 80개를 조회해 DART corp_code와 매칭한 뒤 `Company`에 `isWatched: true`로 upsert. 실행 결과: 79개 등록, 1개 건너뜀.

### `src/scripts/collect-disclosures.ts` (55줄)
워치리스트 기업의 최근 1년치 공시를 조회해 `createMany({ skipDuplicates: true })`로 저장. `rcept_no` unique 제약과 맞물려 재실행해도 중복이 쌓이지 않는다.

### `TROUBLESHOOTING.md` (90줄)
환경/도구 이슈 3건을 원인·해결책과 함께 기록.

1. `prisma dev`가 npm의 새 스크립트 보안 정책과 충돌 → Homebrew 로컬 Postgres로 전환·해결.
2. output 경로를 바꿔도 생성된 클라이언트가 `@prisma/client` 런타임을 필요로 함.
3. data.go.kr 키 이중 인코딩 이슈.

## 수정된 파일

### `prisma/schema.prisma` (+32 / −1)
`Company`, `Disclosure` 모델과 `DisclosureStatus` enum 추가. 클라이언트 output 경로를 rootDir 제약에 맞춰 `src/` 아래로 이동.

```diff
-  output   = "../generated/prisma"
+  output   = "../src/generated/prisma"
+model Company { corpCode String @id ... disclosures Disclosure[] }
+model Disclosure { rceptNo String @unique ... status DisclosureStatus }
```

### `package.json` (+9 / −1)
모듈 시스템을 `commonjs`에서 `module`(ESM)로 전환 — Prisma 7 클라이언트가 `import.meta`를 쓰는 ESM 기준으로 생성되기 때문. 실행 스크립트 2개와 의존성 3종 추가.

```diff
-  "type": "commonjs",
+  "type": "module",
+  "seed:watchlist": "tsc && node --env-file=.env dist/scripts/seed-watchlist.js",
+  "collect:disclosures": "tsc && node --env-file=.env dist/scripts/collect-disclosures.js",
+  "dependencies": { "@prisma/adapter-pg", "@prisma/client", "pg" }
```

### `.gitignore` (+1 / −1)
생성된 Prisma 클라이언트 경로가 옮겨진 것에 맞춰 무시 경로 갱신.

```diff
-/generated/prisma
+/src/generated/prisma
```

### `.env.example` (+3)
`PUBLIC_DATA_API_KEY` 항목 추가 (값은 비워둠).

```diff
+# 공공데이터포털 "금융위원회_주식시세정보" 서비스키
+PUBLIC_DATA_API_KEY=
```

### `package-lock.json` (+358 / −158)
신규 의존성 설치에 따라 npm이 자동으로 갱신 — 수동 편집 없음.

## 검증

```
$ npm run seed:watchlist
시가총액 상위 80개 조회 중...
DART 고유번호 매핑 조회 중...
DART corp_code를 찾지 못해 건너뜀: 삼성전자우 (005935)
완료: 79개 등록, 1개 건너뜀

$ npm run collect:disclosures
워치리스트 79개 기업의 공시를 조회합니다.
조회된 공시 249건 중 신규 249건 저장 (중복 0건 스킵)

$ npm run collect:disclosures
워치리스트 79개 기업의 공시를 조회합니다.
조회된 공시 249건 중 신규 0건 저장 (중복 249건 스킵)
```

✅ **Phase 1 DoD 충족** — 신규 공시만 쌓이고, 동일 스크립트를 재실행해도 중복이 생기지 않음을 확인.

---

다음: 워치리스트 seed 정밀화 또는 Phase 2 (원문 텍스트 추출)
