# DART 리스크 대시보드 Design System

<!-- design-md:section experience -->
## 1. Experience

<!-- design-md:claim scope kind=product-surface lang=en -->
### Scope

워치리스트 종목(50~100개)의 사업보고서·감사보고서에서 자동 탐지된 리스크 플래그를 조회 전용으로 신뢰성 있게 보여준다. 백엔드가 이미 수집·분류를 끝낸 데이터를 노출하는 것이 성공 기준이며, 투자 자문으로 오인되지 않아야 한다.
<!-- design-md:claim-end -->

<!-- design-md:claim primary-tasks kind=user-outcomes count=3 lang=en -->
### Primary tasks

- 워치리스트 종목별 최신 리스크 플래그를 빠르게 훑어본다

- 리스크 상세(확신도·원문 근거 스니펫)를 확인한다

- 심각도(HIGH/MEDIUM/LOW)로 우선순위를 판단한다
<!-- design-md:claim-end -->

### Design direction

- calm

- minimal

- trustworthy

- friendly-but-restrained

### Principles

- 조회 전용 — 대시보드에서 데이터를 쓰거나 수정하지 않는다

- 스코프를 넓히지 않는다 — 5개 리스크 유형, 2개 보고서 타입, 워치리스트 종목 외에는 표시하지 않는다

- disclaimer는 타협 불가 — 어떤 화면에서도 투자 자문처럼 보이는 문구·UI를 만들지 않는다

- 확신도(confidence)와 원문 근거(source_snippet)를 숨기지 않고 보여줘서 룰 기반 분류의 한계를 사용자가 스스로 판단하게 한다

### Avoid

- 매수/매도 추천으로 읽힐 수 있는 문구·색상 (예: LOW 심각도에 초록색 사용)

- 실시간 웹소켓 알림 UI

- 전 상장사 대상 실시간 감시 화면

- 5개 리스크 유형·2개 보고서 타입 외의 데이터 노출

<!-- design-md:section foundations -->
## 2. Foundations

<!-- design-md:claim foundations kind=rules-or-constraints lang=en -->
### Semantic tokens

- **color.body**: `#4e5968` — Toss 실측 본문 텍스트
- **color.border**: `#e5e8eb` — Toss 실측 구분선
- **color.canvas**: `#ffffff` — Toss 실측 canvas
- **color.danger**: `#e42939` — Toss 실측 danger — HIGH 심각도의 근거
- **color.foreground**: `#191f28` — Toss 실측 최강조 텍스트
- **color.muted**: `#8b95a1` — Toss 실측 보조 텍스트 — LOW 심각도에도 재사용
- **color.primary**: `#3182f6` — Toss TDS 실측 primary — 리스크 유형과 무관한 브랜드 액션 색
- **color.primary-hover**: `#2272eb` — Toss TDS 실측 primary-hover
- **color.severity-high-bg**: `#fdecec` — danger(#e42939)를 Toss 자체 weak/strong 공식으로 확장한 값 — agent 제안, 2026-08-25 스와치에서 사용자 확인
- **color.severity-high-fg**: `#e42939` — Toss 실측 danger 그대로 사용
- **color.severity-low-bg**: `#f2f4f6` — = color.surface 재사용, 초록 대신 중립색으로 매수 뉘앙스 방지
- **color.severity-low-fg**: `#8b95a1` — = color.muted 재사용
- **color.severity-medium-bg**: `#fff6e5` — Toss에 없는 amber — 범용 컴플라이언스 관례, 사용자 승인(2026-08-25)
- **color.severity-medium-fg**: `#b26a00` — 위와 동일 provenance
- **color.surface**: `#f2f4f6` — Toss 실측 카드/섹션 배경
- **color.weak-background**: `#e8f3ff` — Toss 실측 weak 배경 — disclaimer 칩에 사용
- **color.weak-foreground**: `#1b64da` — Toss 실측 weak 전경 — disclaimer 칩 텍스트
- **radius.card**: `16` — Toss 실측 rounded, 카드용
- **radius.chip**: `14` — Toss 실측 rounded 계열, 배지/칩용
- **radius.control**: `8` — Toss 실측 rounded.sm~md 대표값
- **spacing.lg**: `24` — Toss 실측
- **spacing.md**: `16` — Toss 실측
- **spacing.sm**: `8` — Toss 실측
- **spacing.xs**: `4` — Toss 실측

### Contrast pairs

- color.foreground on color.canvas: minimum 4.5:1
- color.body on color.canvas: minimum 4.5:1
- color.weak-foreground on color.weak-background: minimum 4.5:1

### Reduced motion

Required.

### Foundation rules

- 색상은 리스크 심각도(HIGH/MEDIUM/LOW) 의미로만 사용하고 매수/매도 뉘앙스를 주지 않는다

- LOW 심각도에는 초록을 쓰지 않는다 — '안전하다/사도 된다'로 오인될 수 있다

- 심각도는 색만으로 구분하지 않고 항상 텍스트 라벨을 함께 표시한다
<!-- design-md:claim-end -->

<!-- design-md:section typography-assets -->
## 3. Typography & Assets

### Type roles

| Role | Usage | Family | Size | Weight | Line height |
|---|---|---|---|---|---|
| body | 카드/목록 기본 본문 | Toss Product Sans, Pretendard, Apple SD Gothic Neo, sans-serif | 16px | 400 | 24px |
| body-small | 보조 텍스트·캡션·확신도 라벨 | Toss Product Sans, Pretendard, Apple SD Gothic Neo, sans-serif | 14px | 400 | 21px |
| heading | 섹션/카드 제목 | Toss Product Sans, Pretendard, Apple SD Gothic Neo, sans-serif | 24px | 600 | 36px |

### Rules

- Toss Product Sans 라이선스 미확인 — 웹 배포 시 Pretendard 또는 시스템 폰트로 대체하고 자간만 유지한다

<!-- design-md:section components-states -->
## 4. Components & States

### Component: risk-badge

**Semantics:** 리스크 심각도를 색과 텍스트로 함께 표시하는 배지

- Anatomy: label
- Variants: HIGH, MEDIUM, LOW, NONE
- States: default
- Token references: color.severity-high-bg, color.severity-high-fg, color.severity-medium-bg, color.severity-medium-fg, color.severity-low-bg, color.severity-low-fg, radius.chip

- Interaction kind: non-interactive
- Interaction reason: 클릭 동작이 없는 정보 표시 전용 요소

### Component: risk-card

**Semantics:** 워치리스트 한 종목의 리스크 상세를 보여주는 카드

- Anatomy: company-name, corp-code, report-type, risk-badge, confidence-value, source-snippet, disclaimer-chip
- States: default
- Token references: color.surface, radius.card

- Interaction kind: non-interactive
- Interaction reason: 카드 자체는 정보 표시용이며 이동 동작은 상위 목록 행에서 발생한다

### Component: watchlist-row

**Semantics:** 워치리스트 목록의 한 행, 클릭 시 상세로 이동

- Anatomy: company-name, corp-code, report-type, risk-type, risk-badge
- Variants: has-risk, no-risk
- States: default, hover, focus-visible
- Token references: color.border

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | not-applicable | 목록 행은 항상 조회 가능하며 비활성화 상태가 없다 |
| loading | not-applicable | 데이터는 백엔드 파이프라인이 미리 채워두므로 행 단위 로딩 상태가 없다 |
| error | not-applicable | 조회 실패는 페이지 레벨 에러로 처리하고 행 단위 에러 상태는 없다 |
| success | not-applicable | 쓰기 동작이 없으므로 성공 상태가 없다 |

### Component: disclaimer-chip

**Semantics:** 투자 자문이 아니라는 상시 고지

- Anatomy: label
- States: default
- Token references: color.weak-background, color.weak-foreground

- Interaction kind: non-interactive
- Interaction reason: 항상 표시되는 고지 문구로 상호작용이 없다

### Rules

- disclaimer-chip은 리스크 정보 근처에서 항상 렌더링되어야 하며 조건부로 숨길 수 없다

- risk-badge는 색상만으로 심각도를 전달하지 않고 HIGH/MEDIUM/LOW 텍스트 라벨을 항상 함께 표시한다

<!-- design-md:section layout-platforms -->
## 5. Layout & Platforms

### Responsive constraints

- Minimum supported width: 320px
- Reflow target: 200% zoom

### Layout rules

- 워치리스트는 반응형 카드/리스트로 표시하고 가로 스크롤을 만들지 않는다

- 표(테이블) 레이아웃 대신 카드형 리스트를 우선한다 — 참고 레퍼런스(toss)가 카드 중심

### Platform: web

- React + Vite SPA, 데스크톱·모바일 웹 브라우저를 지원한다

<!-- design-md:section content-locales -->
## 6. Content & Locales

### Voice

- 차분함

- 다정하지만 절제됨

- 금융 리스크를 정확하고 직접적으로 설명

### Terminology

| Term | Preferred form |
|---|---|
| 리스크 플래그 | 자동 탐지된 잠재 리스크 항목 |
| 워치리스트 | 모니터링 대상으로 등록된 종목 목록 |
| 확신도 | 룰 기반 분류기의 판단 신뢰도 — 투자 신뢰도가 아님 |

### Locale: ko (supported)

- 모든 화면은 한국어를 기본으로 한다
- 금액은 원화 단위를 명시한다

<!-- design-md:section governance -->
## 7. Governance

<!-- design-md:claim authority kind=project-system lang=en -->
### Authority

This document is the project design contract for the declared scope.
<!-- design-md:claim-end -->

<!-- design-md:claim application-priority order=prompt-fact,repository-fact,system-contract,reference-inspiration lang=en -->
### Application priority

1. Direct user instructions for the requested scope.
2. Repository facts.
3. This system contract.
4. Reference inspiration.
<!-- design-md:claim-end -->

<!-- design-md:claim unknowns policy=absent-at-smallest-unresolved-boundary lang=en -->
### Unknowns

Omit only the smallest unresolved value or group. Do not replace it with a plausible default.
<!-- design-md:claim-end -->

<!-- design-md:claim changes policy=review-record-validate-before-adoption lang=en -->
### Changes

Record, review, and validate changes before adoption.
<!-- design-md:claim-end -->

### Project priority details

1. 사용자의 명시 지시

2. 저장소 기존 사실(PRODUCT.md/CLAUDE.md)

3. toss 레퍼런스 검증값

4. 에이전트 제안 중 명시 승인분

### Additional change rules

- DESIGN.md 변경은 omd:apply/omd:learn을 통해서만 반영한다

- 새 브랜드 색상 추가는 프로젝트 오너 승인 후에만 채택한다

### Decision provenance

- foundations.tokens.color.primary.$value — verified-reference-inspiration; value: "#3182f6"; evidence: .claude/data/references/toss/DESIGN.md
- foundations.tokens.color.danger.$value — verified-reference-inspiration; value: "#e42939"; evidence: .claude/data/references/toss/DESIGN.md
- foundations.tokens.color.severity-high-bg.$value — agent-proposed-greenfield-decision; value: "#fdecec"; evidence: .claude/data/references/toss/DESIGN.md, .omd/decisions/phase8-severity-colors.md
- foundations.tokens.color.severity-medium-bg.$value — agent-proposed-greenfield-decision; value: "#fff6e5"; evidence: .omd/decisions/phase8-severity-colors.md
- experience.avoid — repository-fact; value: ["매수/매도 추천으로 읽힐 수 있는 문구·색상 (예: LOW 심각도에 초록색 사용)","실시간 웹소켓 알림 UI","전 상장사 대상 실시간 감시 화면","5개 리스크 유형·2개 보고서 타입 외의 데이터 노출"]; evidence: CLAUDE.md, PRODUCT.md
- content_locales.locales — repository-fact; value: [{"locale":"ko","rules":["모든 화면은 한국어를 기본으로 한다","금액은 원화 단위를 명시한다"],"status":"supported"}]; evidence: CLAUDE.md, PRODUCT.md
- experience.primary_tasks — repository-fact; value: ["워치리스트 종목별 최신 리스크 플래그를 빠르게 훑어본다","리스크 상세(확신도·원문 근거 스니펫)를 확인한다","심각도(HIGH/MEDIUM/LOW)로 우선순위를 판단한다"]; evidence: PRODUCT.md
