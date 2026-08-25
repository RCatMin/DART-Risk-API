import type { RiskFlag } from "../lib/api";
import { RISK_TYPE_LABEL, toSeverityVariant } from "../lib/riskLabels";
import { RiskBadge } from "./RiskBadge";
import { DisclaimerChip } from "./DisclaimerChip";
import "./RiskCard.css";

interface RiskCardProps {
  flag: RiskFlag;
  corpName: string;
  corpCode: string;
}

// DESIGN.md §4 risk-card: 워치리스트 한 종목의 리스크 상세를 보여주는 카드.
export function RiskCard({ flag, corpName, corpCode }: RiskCardProps) {
  const variant = toSeverityVariant(flag.riskType, flag.severity);
  const label = RISK_TYPE_LABEL[flag.riskType];

  return (
    <article className="risk-card">
      <header className="risk-card__top">
        <div className="risk-card__company">
          {corpName}
          <span>{corpCode}</span>
        </div>
        {flag.disclosure && (
          <div className="risk-card__report">{flag.disclosure.reportNm}</div>
        )}
      </header>

      <div className="risk-card__body">
        <div className="risk-card__body-top">
          <RiskBadge variant={variant} label={label} />
          <span className="risk-card__confidence">
            확신도 {Math.round(flag.confidence * 100)}%
          </span>
        </div>
        <div
          className={`risk-card__confidence-track risk-card__confidence-track--${variant.toLowerCase()}`}
          role="progressbar"
          aria-valuenow={Math.round(flag.confidence * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="risk-card__confidence-fill"
            style={{ width: `${Math.round(flag.confidence * 100)}%` }}
          />
        </div>
        <p className="risk-card__snippet">"{flag.sourceSnippet}"</p>
      </div>

      <DisclaimerChip />
    </article>
  );
}
