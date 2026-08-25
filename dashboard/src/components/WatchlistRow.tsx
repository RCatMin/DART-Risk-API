import type { Company, RiskFlag } from "../lib/api";
import { RISK_TYPE_LABEL, toSeverityVariant } from "../lib/riskLabels";
import { RiskBadge } from "./RiskBadge";
import "./WatchlistRow.css";

interface WatchlistRowProps {
  company: Company;
  flags: RiskFlag[];
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

// DESIGN.md §4 watchlist-row: 워치리스트 목록의 한 행, 클릭 시 상세로 이동.
// no-risk 변형은 flags가 빈 배열(해당없음)일 때 — 배지 없이 옅은 텍스트로만 표시한다.
// 한 종목이 서로 다른 유형의 리스크를 동시에 가질 수 있어(예: 소송 + 지분희석), 행에는
// 심각도가 가장 높은 유형(배열의 첫 항목, 서버가 심각도 내림차순으로 정렬해서 준다) 배지만
// 보여주고 나머지는 "+N"으로 표시한다 — 상세는 클릭해서 리스크 상세 카드에서 전부 확인.
// onRemove는 종목 추가/제외 API 연동을 위해 이번 세션에 새로 추가한 것 — DESIGN.md 미반영,
// 다음 omd:learn 때 anatomy에 "remove-button"으로 등록 필요.
export function WatchlistRow({ company, flags, selected, onSelect, onRemove }: WatchlistRowProps) {
  const primary = flags[0] ?? null;
  const extraCount = flags.length - 1;

  const typeLabel =
    flags.length === 0
      ? "해당없음"
      : flags.length === 1
        ? RISK_TYPE_LABEL[primary!.riskType]
        : `${RISK_TYPE_LABEL[primary!.riskType]} 외 ${extraCount}건`;

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
            {company.stockCode} · {primary?.disclosure?.reportNm ?? company.corpCode}
          </span>
        </span>
        <span className="watchlist-row__type">{typeLabel}</span>
        <span className="watchlist-row__badge-group">
          <RiskBadge variant={primary ? toSeverityVariant(primary.riskType, primary.severity) : "NONE"} />
          {extraCount > 0 && <span className="watchlist-row__extra-count">+{extraCount}</span>}
        </span>
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
