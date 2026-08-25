import type { Company, RiskFlag } from "../lib/api";
import { RISK_TYPE_LABEL, toSeverityVariant } from "../lib/riskLabels";
import { RiskBadge } from "./RiskBadge";
import "./WatchlistRow.css";

interface WatchlistRowProps {
  company: Company;
  flag: RiskFlag | null;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

// DESIGN.md §4 watchlist-row: 워치리스트 목록의 한 행, 클릭 시 상세로 이동.
// no-risk 변형은 flag가 null(해당없음)일 때 — 배지 없이 옅은 텍스트로만 표시한다.
// onRemove는 종목 추가/제외 API 연동을 위해 이번 세션에 새로 추가한 것 — DESIGN.md 미반영,
// 다음 omd:learn 때 anatomy에 "remove-button"으로 등록 필요.
export function WatchlistRow({ company, flag, selected, onSelect, onRemove }: WatchlistRowProps) {
  return (
    <li className={`watchlist-row${selected ? " watchlist-row--selected" : ""}`}>
      <button
        type="button"
        className={`watchlist-row__button${selected ? " watchlist-row__button--selected" : ""}`}
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span className="watchlist-row__name">
          {company.corpName}
          <span>
            {company.stockCode} · {flag?.disclosure?.reportNm ?? company.corpCode}
          </span>
        </span>
        <span className="watchlist-row__type">
          {flag ? RISK_TYPE_LABEL[flag.riskType] : "해당없음"}
        </span>
        <RiskBadge variant={flag ? toSeverityVariant(flag.riskType, flag.severity) : "NONE"} />
      </button>
      {onRemove && (
        <button
          type="button"
          className="watchlist-row__remove"
          aria-label={`${company.corpName} 워치리스트에서 제외`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </li>
  );
}
