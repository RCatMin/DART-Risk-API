import { useState } from "react";
import type { FormEvent } from "react";
import { addCompany, searchCompanies, type Company, type CompanySearchResult } from "../lib/api";
import { searchMock } from "../lib/companyMock";
import "./AddCompanyPanel.css";

interface AddCompanyPanelProps {
  existingCorpCodes: string[];
  onAdded: (company: Company) => void;
  onClose: () => void;
}

const RESULTS_PER_PAGE = 5;

// DESIGN.md에는 아직 없는 컴포넌트 — 워치리스트 종목 추가 API(POST /api/companies,
// GET /api/companies/search) 연동용. 다음 omd:learn 때 components-states에 정식 등록 필요.
export function AddCompanyPanel({ existingCorpCodes, onAdded, onClose }: AddCompanyPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const [usingMock, setUsingMock] = useState(false);
  const [addingCorpCode, setAddingCorpCode] = useState<string | null>(null);

  const pageCount = Math.ceil(results.length / RESULTS_PER_PAGE);
  const pagedResults = results.slice(page * RESULTS_PER_PAGE, page * RESULTS_PER_PAGE + RESULTS_PER_PAGE);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setStatus("searching");
    try {
      const res = await searchCompanies(query);
      setResults(res.data);
      setUsingMock(false);
      setStatus("idle");
    } catch {
      setResults(searchMock(query, existingCorpCodes));
      setUsingMock(true);
      setStatus("idle");
    }
    setPage(0);
  }

  async function handleAdd(candidate: CompanySearchResult) {
    setAddingCorpCode(candidate.corpCode);
    try {
      const company = await addCompany(candidate);
      onAdded(company);
    } catch {
      // 백엔드 미연결 — 로컬 상태에만 추가된 것처럼 반영
      onAdded({ ...candidate, isWatched: true });
    } finally {
      setAddingCorpCode(null);
    }
  }

  return (
    <div className="add-company-panel">
      <form className="add-company-panel__form" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목코드 또는 회사명 (예: 005930, 네이버)"
          className="add-company-panel__input"
          autoFocus
        />
        <button type="submit" className="add-company-panel__search-button">
          검색
        </button>
        <button type="button" className="add-company-panel__close-button" onClick={onClose}>
          닫기
        </button>
      </form>

      {usingMock && (
        <p className="add-company-panel__mock-note">백엔드 API 미연결 — 목업 검색 결과예요</p>
      )}

      {status === "idle" && results.length === 0 && query && (
        <p className="add-company-panel__empty">검색 결과가 없어요</p>
      )}

      <ul className="add-company-panel__results">
        {pagedResults.map((candidate) => {
          const alreadyWatched = existingCorpCodes.includes(candidate.corpCode);
          return (
            <li key={candidate.corpCode} className="add-company-panel__result-row">
              <span className="add-company-panel__result-name">
                {candidate.corpName}
                <span>
                  {candidate.stockCode} · {candidate.corpCode}
                </span>
              </span>
              <button
                type="button"
                className="add-company-panel__add-button"
                disabled={alreadyWatched || addingCorpCode === candidate.corpCode}
                onClick={() => handleAdd(candidate)}
              >
                {alreadyWatched ? "추가됨" : addingCorpCode === candidate.corpCode ? "추가 중…" : "추가"}
              </button>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <div className="add-company-panel__pagination">
          <button
            type="button"
            className="add-company-panel__page-button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            이전
          </button>
          <span className="add-company-panel__page-status">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="add-company-panel__page-button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
