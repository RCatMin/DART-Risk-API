import type { Company, CompanySearchResult, RiskSummaryEntry } from "./api";

// 백엔드 미연결 시 워치리스트 초기 상태로 쓰는 목업 — GET /api/companies/risk-summary 형태 그대로.
export const MOCK_RISK_SUMMARY: RiskSummaryEntry[] = [
  {
    company: { corpCode: "00126380", corpName: "삼성전자", stockCode: "005930", isWatched: true },
    riskFlag: {
      id: 1,
      disclosureId: 1,
      riskType: "litigation",
      severity: "high",
      summary: "계열사 관련 소송 피고 지정",
      confidence: 0.91,
      sourceSnippet:
        "당사는 계열사 관련 소송에서 피고로 지정되었으며, 청구금액은 자기자본의 12%에 해당하는 320억원입니다.",
      createdAt: new Date().toISOString(),
      disclosure: {
        rceptNo: "20260301000001",
        reportNm: "사업보고서",
        rceptDt: "2026-03-01",
        corpCode: "00126380",
      },
    },
  },
  {
    company: { corpCode: "00164779", corpName: "SK하이닉스", stockCode: "000660", isWatched: true },
    riskFlag: {
      id: 2,
      disclosureId: 2,
      riskType: "audit_opinion_adverse",
      severity: "medium",
      summary: "감사인 한정의견",
      confidence: 0.63,
      sourceSnippet: "감사인은 계속기업 존속능력에 대한 불확실성과 관련하여 한정의견을 표명하였습니다.",
      createdAt: new Date().toISOString(),
      disclosure: {
        rceptNo: "20260228000002",
        reportNm: "감사보고서",
        rceptDt: "2026-02-28",
        corpCode: "00164779",
      },
    },
  },
  {
    company: { corpCode: "00164742", corpName: "현대차", stockCode: "005380", isWatched: true },
    riskFlag: null,
  },
];

// 백엔드 미연결 시 "/api/companies/search"를 흉내내는 후보 목록 — 아직 워치리스트에 없는 종목들.
const MOCK_SEARCH_CANDIDATES: CompanySearchResult[] = [
  { corpCode: "00401731", corpName: "네이버", stockCode: "035420" },
  { corpCode: "00918212", corpName: "카카오", stockCode: "035720" },
  { corpCode: "00356361", corpName: "셀트리온", stockCode: "068270" },
  { corpCode: "00674534", corpName: "LG에너지솔루션", stockCode: "373220" },
  { corpCode: "00126186", corpName: "POSCO홀딩스", stockCode: "005490" },
];

export function searchMock(q: string, excludeCorpCodes: string[]): CompanySearchResult[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return MOCK_SEARCH_CANDIDATES.filter(
    (c) =>
      !excludeCorpCodes.includes(c.corpCode) &&
      (c.stockCode === q.trim() || c.corpName.toLowerCase().includes(query)),
  ).slice(0, 20);
}

export function mockCompanyToSummary(company: Company): RiskSummaryEntry {
  return { company, riskFlag: null };
}
