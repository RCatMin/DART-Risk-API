// openapi.yaml(Phase 7 산출물)을 그대로 반영한 타입/클라이언트입니다.
// 엔드포인트나 스키마가 바뀌면 openapi.yaml을 먼저 갱신한 뒤 이 파일을 맞추세요.

export type RiskType =
  | "audit_opinion_adverse"
  | "embezzlement"
  | "litigation"
  | "management_designation"
  | "insolvency"
  | "dilution"
  | "not_applicable";

export type RiskSeverity = "low" | "medium" | "high";

export interface RiskFlag {
  id: number;
  disclosureId: number;
  riskType: RiskType;
  severity: RiskSeverity;
  summary: string;
  confidence: number;
  sourceSnippet: string;
  createdAt: string;
  disclosure?: {
    rceptNo: string;
    reportNm: string;
    rceptDt: string;
    corpCode: string;
    company?: { corpName: string };
  };
}

export interface Company {
  corpCode: string;
  corpName: string;
  stockCode: string;
  isWatched: boolean;
}

interface OkEnvelope<T> {
  data: T;
  meta?: { disclaimer?: string };
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<OkEnvelope<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `API ${path} 실패: ${res.status}`);
  }
  return res.json();
}

export function fetchRiskFlags(params?: {
  severity?: RiskSeverity;
  riskType?: RiskType;
  corpCode?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.severity) qs.set("severity", params.severity);
  if (params?.riskType) qs.set("riskType", params.riskType);
  if (params?.corpCode) qs.set("corpCode", params.corpCode);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<RiskFlag[]>(`/api/risk-flags${suffix}`);
}

export function fetchCompanies(params?: { isWatched?: "true" | "false" | "all" }) {
  const qs = params?.isWatched ? `?isWatched=${params.isWatched}` : "";
  return request<Company[]>(`/api/companies${qs}`);
}

export interface RiskSummaryEntry {
  company: Company;
  // 회사 하나가 서로 다른 유형의 리스크를 동시에 가질 수 있어(예: 소송 + 지분희석)
  // 서버가 유형별 대표 플래그를 심각도 내림차순 배열로 준다 — not_applicable은 서버에서
  // 이미 제외되어 있으므로 빈 배열이면 진짜 "해당없음"이다.
  riskFlags: RiskFlag[];
}

export function fetchRiskSummary(params?: { isWatched?: "true" | "false" | "all" }) {
  const qs = params?.isWatched ? `?isWatched=${params.isWatched}` : "";
  return request<RiskSummaryEntry[]>(`/api/companies/risk-summary${qs}`);
}

export interface CompanySearchResult {
  corpCode: string;
  corpName: string;
  stockCode: string;
}

// DART 전체 상장사 대상 검색 (우리 DB가 아니라 corpCode.xml 직접 조회) — 아직 워치리스트에 없는 종목도 찾는다.
export function searchCompanies(q: string) {
  return request<CompanySearchResult[]>(`/api/companies/search?q=${encodeURIComponent(q)}`);
}

// /api/companies/search 결과를 그대로 넘겨 워치리스트에 추가한다(신규/기존 upsert).
export async function addCompany(payload: CompanySearchResult): Promise<Company> {
  const res = await request<Company>("/api/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function setCompanyWatched(corpCode: string, isWatched: boolean): Promise<Company> {
  const res = await request<Company>(`/api/companies/${corpCode}`, {
    method: "PATCH",
    body: JSON.stringify({ isWatched }),
  });
  return res.data;
}
