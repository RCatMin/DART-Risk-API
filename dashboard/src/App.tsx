import { useEffect, useState } from "react";
import { fetchRiskSummary, setCompanyWatched, type Company, type RiskSummaryEntry } from "./lib/api";
import { MOCK_RISK_SUMMARY, mockCompanyToSummary } from "./lib/companyMock";
import { MOCK_INDICES, MOCK_WATCHLIST_PRICES } from "./lib/marketMock";
import { eunNeun } from "./lib/korean";
import { RiskCard } from "./components/RiskCard";
import { WatchlistRow } from "./components/WatchlistRow";
import { DisclaimerChip } from "./components/DisclaimerChip";
import { MarketPanel } from "./components/MarketPanel";
import { AddCompanyPanel } from "./components/AddCompanyPanel";
import "./App.css";

function App() {
  // GET /api/companies/risk-summary가 회사마다 "가장 심각하고 동률이면 가장 최근인 리스크 1건"을
  // 이미 계산해서 주므로, 클라이언트에서 별도로 flagByCorpCode 같은 걸 다시 만들 필요가 없다.
  const [summaries, setSummaries] = useState<RiskSummaryEntry[] | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [selectedCorpCode, setSelectedCorpCode] = useState<string | null>(null);
  const [isAddPanelOpen, setAddPanelOpen] = useState(false);

  useEffect(() => {
    fetchRiskSummary({ isWatched: "true" })
      .then((res) => {
        setSummaries(res.data);
        setSelectedCorpCode(res.data[0]?.company.corpCode ?? null);
      })
      .catch(() => {
        setUsingMock(true);
        setSummaries(MOCK_RISK_SUMMARY);
        setSelectedCorpCode(MOCK_RISK_SUMMARY[0]?.company.corpCode ?? null);
      });
  }, []);

  const selectedEntry = summaries?.find((s) => s.company.corpCode === selectedCorpCode) ?? null;
  const selectedCompany = selectedEntry?.company ?? null;
  const selectedFlag = selectedEntry?.riskFlag ?? null;

  function handleAdded(company: Company) {
    setSummaries((prev) => {
      const existing = prev ?? [];
      if (existing.some((s) => s.company.corpCode === company.corpCode)) return existing;
      return [...existing, mockCompanyToSummary(company)];
    });
    setSelectedCorpCode(company.corpCode);
    setAddPanelOpen(false);
  }

  async function handleRemove(corpCode: string) {
    try {
      await setCompanyWatched(corpCode, false);
    } catch {
      // 백엔드 미연결 — 로컬 상태에서만 제외
    }
    setSummaries((prev) => {
      const next = (prev ?? []).filter((s) => s.company.corpCode !== corpCode);
      if (selectedCorpCode === corpCode) {
        setSelectedCorpCode(next[0]?.company.corpCode ?? null);
      }
      return next;
    });
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>워치리스트 리스크 현황</h1>
        <p className="page__subtitle">
          {usingMock ? "백엔드 API 미연결 — 목업 데이터로 표시 중" : "실시간 조회 결과"}
        </p>
      </header>

      <div className="page__layout">
        <div className="page__main">
          <section className="page__section">
            <div className="page__section-header">
              <h2>워치리스트</h2>
              <button
                type="button"
                className="page__add-toggle"
                onClick={() => setAddPanelOpen((v) => !v)}
              >
                {isAddPanelOpen ? "닫기" : "+ 종목 추가"}
              </button>
            </div>

            {isAddPanelOpen && (
              <AddCompanyPanel
                existingCorpCodes={summaries?.map((s) => s.company.corpCode) ?? []}
                onAdded={handleAdded}
                onClose={() => setAddPanelOpen(false)}
              />
            )}

            <ul className="watchlist">
              {summaries?.map(({ company, riskFlag }) => (
                <WatchlistRow
                  key={company.corpCode}
                  company={company}
                  flag={riskFlag}
                  selected={company.corpCode === selectedCorpCode}
                  onSelect={() => setSelectedCorpCode(company.corpCode)}
                  onRemove={() => handleRemove(company.corpCode)}
                />
              ))}
            </ul>
          </section>

          {selectedCompany && (
            <section className="page__section">
              <h2>선택한 종목 리스크 상세</h2>
              {selectedFlag ? (
                <RiskCard
                  flag={selectedFlag}
                  corpName={selectedCompany.corpName}
                  corpCode={selectedCompany.corpCode}
                />
              ) : (
                <div className="no-risk-notice">
                  <p className="no-risk-notice__text">
                    {selectedCompany.corpName}
                    {eunNeun(selectedCompany.corpName)} 현재 탐지된 리스크가 없어요 (해당없음)
                  </p>
                  <DisclaimerChip />
                </div>
              )}
            </section>
          )}
        </div>

        <MarketPanel indices={MOCK_INDICES} watchlistPrices={MOCK_WATCHLIST_PRICES} isMock />
      </div>

      <DisclaimerChip />
    </div>
  );
}

export default App;
