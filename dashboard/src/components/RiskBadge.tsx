import type { SeverityVariant } from "../lib/riskLabels";
import "./RiskBadge.css";

interface RiskBadgeProps {
  variant: SeverityVariant;
  /** 리스크 유형 라벨. 카드처럼 배지 하나만 보이는 곳에서 넘기면 "HIGH · 소송"으로 합쳐 보여준다.
   *  워치리스트 행처럼 유형이 이미 별도 컬럼에 있으면 생략 — 배지는 심각도 단어만 보여준다. */
  label?: string;
}

// DESIGN.md §4 risk-badge: 색만으로 심각도를 전달하지 않고 텍스트 라벨을 항상 함께 표시한다.
export function RiskBadge({ variant, label }: RiskBadgeProps) {
  if (variant === "NONE") {
    return <span className="risk-badge risk-badge--none">—</span>;
  }
  return (
    <span className={`risk-badge risk-badge--${variant.toLowerCase()}`}>
      {label ? `${variant} · ${label}` : variant}
    </span>
  );
}
