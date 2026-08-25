# Phase 8 — 리스크 심각도(severity) 색상 결정 기록

날짜: 2026-08-25
결정자: 프로젝트 오너 (RCatMin), 진행: Claude Code

## 배경

Phase 8 대시보드 디자인 시스템으로 `toss` 레퍼런스를 채택한 뒤, 워치리스트 리스크 카드가
HIGH/MEDIUM/LOW 세 심각도를 어떻게 색으로 구분할지 결정이 필요했다. 세 심각도 각각을
Toss 톤 그대로 재현한 비교 아티팩트를 만들어 실제로 보여준 뒤 확정했다.

## 결정

### HIGH — `#fdecec` / `#e42939`
Toss가 `.claude/data/references/toss/DESIGN.md`에서 실측한 danger 토큰(`#e42939`)을 그대로
전경색으로 쓰고, 배경은 Toss 자신이 이미 쓰는 weak/strong 공식(예: `weak-background`
`#e8f3ff` + `weak-foreground` `#1b64da`)을 danger 색에 동일하게 적용해 유도했다. 브랜드
검증 토큰의 연장이라 근거가 명확함.

### MEDIUM — `#fff6e5` / `#b26a00`
Toss DESIGN.md에는 amber 계열 토큰이 없다. 컴플라이언스/리스크 UI에서 흔히 쓰이는
범용 amber 관례를 제안했고, 사용자가 세 심각도 비교 아티팩트를 확인한 뒤 "없어"
(추가 변경 없음, 이대로 진행)로 명시 승인했다.

### LOW — `#f2f4f6` / `#8b95a1`
Toss의 muted/surface 토큰을 그대로 재사용했다. 초록(green)은 의도적으로 배제했다 —
CLAUDE.md/PRODUCT.md의 "매수/매도 추천으로 읽힐 수 있는 색상 금지" 스코프 규칙과 충돌할
수 있기 때문 (낮은 심각도를 초록으로 표시하면 "안전하다 = 사도 된다"로 오인될 위험).

## 컴포넌트 결정

같은 세션에서 만든 카드/워치리스트 목록 비교 아티팩트를 기반으로 다음 4개 컴포넌트를
확정했다: `risk-badge`(심각도 배지), `risk-card`(리스크 상세 카드), `watchlist-row`
(목록 행), `disclaimer-chip`(투자 자문 아님 고지). disclaimer-chip은 모든 리스크 표시
근처에 항상 노출되어야 하며 조건부로 숨길 수 없다는 규칙도 이 세션에서 확정했다.
</content>
