# Phase 2 작업 로그 — 공시원문 텍스트 추출

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 2 / 7
- **date**: 2026-08-21

Phase 1에서 모아둔 공시 249건은 제목/접수번호만 있는 상태였습니다. Phase 2는 DART에서 실제 보고서 원문을 받아와 순수 텍스트로 변환해 DB에 채우는 작업입니다.

## 요약

| 항목 | 값 |
|---|---|
| 변경된 파일 | 5개 |
| 새로 만든 파일 | 3개 |
| 신규 npm 패키지 | 0개 (macOS 기본 `unzip` CLI만 사용) |
| 스키마 마이그레이션 | 0건 (Phase 1에서 `raw_text`/`status` 컬럼을 이미 준비해둠) |

## 사전 조사

코드를 쓰기 전에 삼성전자 사업보고서 하나(`rcept_no=20260310002820`)를 직접 내려받아 구조를 확인했습니다.

- DART `document.xml` API는 **zip 파일**을 준다.
- zip 안에는 사업보고서 본문 하나만 있는 게 아니라, 첨부된 **감사보고서**, **연결감사보고서**까지 XML 파일 3개가 같이 들어있다 (각 파일의 `<DOCUMENT-NAME>` 태그로 구분 가능).
- 인코딩은 `<?xml ... encoding="utf-8"?>` 선언 그대로 실제 **UTF-8**이었다 (처음에 `cat -v`로 봤을 때 깨진 것처럼 보여서 EUC-KR/CP949를 의심했지만, 알고 보니 멀티바이트 문자를 8진 이스케이프로 보여주는 `cat -v`의 표시 방식 때문이었고, 실제로는 정상 UTF-8이었음). 그래서 `iconv-lite` 같은 인코딩 변환 패키지가 필요 없었다.

이 조사 덕분에 별도 라이브러리 설치 없이 바로 구현할 수 있었습니다.

## 새로 만든 파일

### `src/lib/zip.ts` (28줄)
zip 버퍼를 임시 디렉터리에 풀고, 안의 모든 파일을 UTF-8 텍스트로 읽어 반환하는 공용 유틸. DART가 zip으로만 파일을 주는 API가 여러 개(`corpCode.xml`, `document.xml`)라서 공용 함수로 분리했다.

### `src/dart/document.ts` (53줄)
`document.xml` API로 공시 원문 zip을 받아, `report_nm`과 같은 종류("사업보고서" 또는 "감사보고서")의 문서만 골라내고, `<TABLE>`/`<TR>`/`<P>` 같은 태그를 제거해 순수 텍스트로 변환한다. 후보가 여럿이면(감사보고서 vs 연결감사보고서) 본문이 더 긴 쪽을 채택한다.

### `src/scripts/extract-texts.ts` (51줄)
`status='pending'`인 공시를 순회하며 텍스트를 추출해 `raw_text`에 저장하고 `status`를 `done`/`failed`로 갱신한다. 실패해도 해당 건만 넘어가고 나머지는 계속 처리한다. CLI 인자로 처리 건수를 제한할 수 있다 (`npm run extract:texts -- 5`).

## 수정된 파일

### `src/dart/corpCode.ts` (+13 / −26)
zip 다운로드·해제 로직을 걷어내고 `src/lib/zip.ts`의 `unzipToText()`를 호출하도록 리팩터링 — 코드 중복 제거.

```diff
-import { execFileSync } from "node:child_process";
-import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
-import { tmpdir } from "node:os";
-import { join } from "node:path";
+import { unzipToText } from "../lib/zip.js";
```

### `package.json` (+1)
```diff
+    "extract:texts": "tsc && node --env-file=.env dist/scripts/extract-texts.js",
```

## 실행 결과

```
$ npm run extract:texts -- 6
텍스트 추출 대상 공시 6건
완료: [기재정정]사업보고서 (2025.12) (20260814004019) — 1,553,558자
...
완료 6건, 실패 0건

$ npm run extract:texts -- 15
...
완료: [기재정정]감사보고서제출               (20260515803411) — 5,353자
...
완료 14건, 실패 1건
실패: ... Error: zip 형식이 아닙니다: ... "014" "파일이 존재하지 않습니다."

$ npm run extract:texts        # 나머지 228건
...
완료 218건, 실패 10건
```

**최종**: 249건 중 **238건 `done`**, **11건 `failed`**.

실패한 11건은 전부 `[기재정정]`/`[첨부정정]` 유형의 정정 공시였습니다. DART가 이런 정정 건은 단독 원문 파일을 제공하지 않고 `014 파일이 존재하지 않습니다`를 응답하는데, 이는 코드 문제가 아니라 DART 쪽 데이터 특성이라 정상적인 실패로 처리했습니다.

✅ **Phase 2 DoD 충족** — 사업보고서 다수 + 감사보고서 2건 이상 텍스트 추출 성공 확인.

---

다음: Phase 3 (키워드 1차 필터 + Claude API 분류/요약)
