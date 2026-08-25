import "./DisclaimerChip.css";

// DESIGN.md §4 disclaimer-chip: 리스크 정보 근처에서 항상 렌더링, 조건부로 숨길 수 없다.
export function DisclaimerChip() {
  return (
    <p className="disclaimer-chip">투자 자문이 아닌 참고용 정보예요</p>
  );
}
