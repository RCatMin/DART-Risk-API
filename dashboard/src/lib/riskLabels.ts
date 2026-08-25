import type { RiskSeverity, RiskType } from "./api";

// 리스크 유형 라벨 — openapi.yaml RiskType enum과 1:1로 맞춘다(현재 7개).
export const RISK_TYPE_LABEL: Record<RiskType, string> = {
  audit_opinion_adverse: "감사의견 비적정",
  embezzlement: "횡령·배임",
  litigation: "소송",
  management_designation: "관리종목 지정",
  insolvency: "부도·회생절차",
  dilution: "지분희석",
  not_applicable: "해당없음",
};

export type SeverityVariant = "HIGH" | "MEDIUM" | "LOW" | "NONE";

// DESIGN.md risk-badge variants(HIGH/MEDIUM/LOW/NONE)로 매핑.
// riskType이 not_applicable이면 severity와 무관하게 NONE — 배지 자체를 표시하지 않는다.
export function toSeverityVariant(
  riskType: RiskType,
  severity: RiskSeverity,
): SeverityVariant {
  if (riskType === "not_applicable") return "NONE";
  return severity.toUpperCase() as SeverityVariant;
}
