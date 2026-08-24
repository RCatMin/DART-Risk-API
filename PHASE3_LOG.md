# Phase 3 작업 로그 — 키워드+룰 기반 리스크 분류

- **repo**: dart-risk-api
- **branch**: DARTAPI
- **phase**: 3 / 7
- **date**: 2026-08-21

원래 계획은 "키워드 1차 필터 + Claude API 분류/요약"이었지만, 지금 API 크레딧을 충전할 수 없는 상황이라 이번 Phase는 **키워드 매칭 + 부정문 감지 규칙 엔진**으로 대체 구현했습니다. Claude API 연동은 CLAUDE.md에 "크레딧 확보 후 보강"으로 명시해두고 코드 자리는 남겨두지 않았습니다(미사용 코드를 남기지 않기 위해 설치했던 `@anthropic-ai/sdk`, `zod`는 다시 제거).

## 요약

| 항목 | 값 |
|---|---|
| 변경된 파일 | 6개 |
| 새로 만든 파일 | 3개 (룰 엔진, 분류 스크립트, 마이그레이션) |
| 스키마 변경 | `RiskFlag` 모델 + `RiskType`/`RiskSeverity` enum 추가 |
| CLAUDE.md 변경 | Phase 3 내용 및 기술스택 한 줄 수정 (사용자 명시적 요청에 따른 변경) |

## 스키마: `RiskFlag`

```diff
+enum RiskType {
+  audit_opinion_adverse
+  embezzlement
+  litigation
+  management_designation
+  not_applicable
+}

+enum RiskSeverity {
+  low
+  medium
+  high
+}

+model RiskFlag {
+  id            Int          @id @default(autoincrement())
+  disclosureId  Int          @map("disclosure_id")
+  disclosure    Disclosure   @relation(fields: [disclosureId], references: [id])
+  riskType      RiskType     @map("risk_type")
+  severity      RiskSeverity
+  summary       String
+  confidence    Float
+  sourceSnippet String       @map("source_snippet")
+  createdAt     DateTime     @default(now()) @map("created_at")
+
+  @@map("risk_flags")
+  @@index([disclosureId])
+}
```

CLAUDE.md 데이터 모델 초안의 `RiskType` 5종(감사의견 비적정 / 횡령·배임 / 소송 / 관리종목 지정 / 해당없음)을 enum으로 그대로 고정했습니다.

## 새로 만든 파일

### `src/risk/rules.ts` (103줄)
키워드 매칭 기반 리스크 탐지 엔진.

- 4개 리스크 유형별 키워드 목록 (`의견거절/부적정의견/한정의견` · `횡령/배임` · `소송/피소/손해배상청구` · `관리종목/상장폐지/거래정지`)
- **부정문 감지**: 매칭 지점 주변 40자 내에 "없습니다/해당없음/전무" 등이 있으면 오탐으로 버림 (사업보고서는 "소송 없음" 식 보일러플레이트가 대부분이라 필수)
- **최소 길이 필터**: 40자 미만 스니펫은 버림 (재무제표 주석의 "소송충당부채" 같은 표 항목 라벨이 실제 사건 서술처럼 잡히는 걸 방지)
- **문서당 유형별 최대 5건 상한**: 자회사별로 반복되는 보일러플레이트가 한 문서에서 수십 건씩 잡히는 걸 방지
- 매칭 지점을 포함한 줄(태그 스트리핑으로 생긴 줄바꿈 단위) 전체를 `source_snippet`으로 채택

### `src/scripts/classify-risks.ts` (58줄)
`status='done'`이고 아직 `riskFlags`가 없는 공시를 순회하며 `evaluateRisk()`를 실행. 감지된 리스크가 있으면 유형별로 `RiskFlag`를 생성하고, 없으면 `risk_type='not_applicable'` 플래그 하나를 남겨 "처리 완료, 리스크 없음"을 표시.

### `prisma/migrations/20260821071912_add_risk_flag/`
`risk_flags` 테이블 생성 마이그레이션.

## 수동 샘플 검증 — 발견하고 고친 오탐

1차 실행(238건 처리) 후 10건을 랜덤 샘플링해서 직접 검토한 결과, 심각한 오탐 2종을 발견하고 수정했습니다.

| 오탐 유형 | 예시 | 원인 | 조치 |
|---|---|---|---|
| 숫자+"배임" 우연 매칭 | "충전시간이 약**5배임**을 감안할 경우" (전기차 얘기) | "5배 + 이다"의 "배임" 두 글자가 "배임(횡령)"과 우연히 일치 | `배임` 키워드 매칭 시 바로 앞 글자가 숫자면 제외 |
| 준법교육 안내문 | "영업비밀보호법 위반, 횡령, 금품수수... **예방 교육**" | 실제 사건이 아니라 사내 준법교육 커리큘럼 소개 문장 | 스니펫에 "교육"/"가이드라인"이 있으면 제외 |

수정 후 `risk_flags` 테이블을 비우고 재실행, 다시 10건을 샘플링해 재검증했습니다.

**2차 검증 결과** (10건 중)
- ✅ 명확히 정상 7건 — 구체적 금액·건수가 명시된 실제 소송/배임 사건
- ⚠️ 약한 매칭 3건 — 헤더 문장이거나, "소송에 패소한 경우 대손 처리한다"처럼 일반 회계정책 조항에 키워드가 우연히 포함된 경우

**알려진 한계**: 순수 키워드 규칙으로는 "정책 문구 속에 키워드가 우연히 섞인 경우"까지 완벽히 걸러낼 수 없습니다. 이 지점이 원래 Claude API가 맡으려던 "진짜 사건인지 판단"하는 역할이라, 크레딧이 확보되면 이 부분을 보강할 계획입니다.

## 최종 분류 결과 (공시 238건 전체)

| risk_type | 건수 |
|---|---|
| litigation | 472 |
| not_applicable | 135 |
| management_designation | 34 |
| embezzlement | 29 |
| audit_opinion_adverse | 9 |

✅ **Phase 3 DoD 충족** — RiskFlag 저장 확인, 수동 샘플 10건 검증 완료(2회, 오탐 발견 및 수정 포함).

---

다음: Phase 4 (BullMQ 전환, 수집/파싱/분류 job 분리, 재시도·백오프)
