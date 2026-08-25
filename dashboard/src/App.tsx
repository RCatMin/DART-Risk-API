import { useEffect, useState } from "react";
import { fetchRiskSummary, setCompanyWatched, type Company, type RiskSummaryEntry } from "./lib/api";
import { MOCK_RISK_SUMMARY, mockCompanyToSummary } from "./lib/companyMock";
import { MOCK_INDICES, MOCK_WATCHLIST_PRICES } from "./lib/marketMock";
import { eunNeun } from "./lib/korean";
import {
  addCorpCodesToGroup,
  createGroup,
  deleteGroup,
  loadGroups,
  makeGroup,
  removeCorpCodeFromGroups,
  type CompanyGroup,
} from "./lib/groups";
import { RiskCard } from "./components/RiskCard";
import { WatchlistRow } from "./components/WatchlistRow";
import { DisclaimerChip } from "./components/DisclaimerChip";
import { MarketPanel } from "./components/MarketPanel";
import { AddCompanyPanel } from "./components/AddCompanyPanel";
import { GroupModal } from "./components/GroupModal";
import { AddToGroupPanel } from "./components/AddToGroupPanel";
import "./App.css";

const WATCHLIST_PAGE_SIZE = 5;

function App() {
  // GET /api/companies/risk-summary가 회사마다 유형별 대표 리스크 플래그를 심각도
  // 내림차순 배열로 이미 계산해서 주므로, 클라이언트에서 별도로 flagByCorpCode 같은 걸
  // 다시 만들 필요가 없다.
  const [summaries, setSummaries] = useState<RiskSummaryEntry[] | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [selectedCorpCode, setSelectedCorpCode] = useState<string | null>(null);
  const [isAddPanelOpen, setAddPanelOpen] = useState(false);
  const [watchlistPage, setWatchlistPage] = useState(0);

  // 그룹은 백엔드에 아직 없는 개념이라 브라우저 로컬(localStorage)에만 보관한다.
  const [groups, setGroups] = useState<CompanyGroup[]>(() => loadGroups());
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isAddToGroupOpen, setAddToGroupOpen] = useState(false);

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
  const selectedFlags = selectedEntry?.riskFlags ?? [];

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const visibleSummaries = activeGroup
    ? summaries?.filter((s) => activeGroup.corpCodes.includes(s.company.corpCode))
    : summaries;

  const watchlistPageCount = visibleSummaries
    ? Math.max(1, Math.ceil(visibleSummaries.length / WATCHLIST_PAGE_SIZE))
    : 1;
  const pagedSummaries = visibleSummaries?.slice(
    watchlistPage * WATCHLIST_PAGE_SIZE,
    watchlistPage * WATCHLIST_PAGE_SIZE + WATCHLIST_PAGE_SIZE,
  );

  // 종목 제외, 그룹 필터 전환 등으로 마지막 페이지가 비면 그 앞 페이지로 당겨온다.
  useEffect(() => {
    setWatchlistPage((p) => Math.min(p, watchlistPageCount - 1));
  }, [watchlistPageCount]);

  useEffect(() => {
    setWatchlistPage(0);
    setAddToGroupOpen(false);
  }, [activeGroupId]);

  function pageOf(corpCode: string, list: RiskSummaryEntry[]) {
    const idx = list.findIndex((s) => s.company.corpCode === corpCode);
    return idx >= 0 ? Math.floor(idx / WATCHLIST_PAGE_SIZE) : 0;
  }

  async function handleAdded(company: Company) {
    // 추가 직후엔 일단 낙관적으로 반영(리스크 없음)해서 바로 목록에 보이게 하고,
    // 이어서 risk-summary를 다시 불러와 실제 리스크 데이터로 덮어쓴다 —
    // 안 그러면 새로고침 전까지 계속 "해당없음"으로만 보임.
    setSummaries((prev) => {
      const existing = prev ?? [];
      if (existing.some((s) => s.company.corpCode === company.corpCode)) return existing;
      const next = [...existing, mockCompanyToSummary(company)];
      setWatchlistPage(pageOf(company.corpCode, next));
      return next;
    });
    setSelectedCorpCode(company.corpCode);
    setAddPanelOpen(false);

    try {
      const res = await fetchRiskSummary({ isWatched: "true" });
      setSummaries(res.data);
      setWatchlistPage(pageOf(company.corpCode, res.data));
      setUsingMock(false);
    } catch {
      // 백엔드 미연결 — 위에서 넣은 낙관적 상태를 그대로 유지
    }
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
    setGroups((prev) => removeCorpCodeFromGroups(prev, corpCode));
  }

  function handleCreateGroup(name: string, corpCodes: string[]) {
    const group = makeGroup(name, corpCodes);
    setGroups((prev) => createGroup(prev, group));
    setActiveGroupId(group.id);
    setGroupModalOpen(false);
  }

  function handleDeleteGroup(groupId: string) {
    setGroups((prev) => deleteGroup(prev, groupId));
    if (activeGroupId === groupId) setActiveGroupId(null);
  }

  function handleAddToGroup(corpCodes: string[]) {
    if (!activeGroupId) return;
    setGroups((prev) => addCorpCodesToGroup(prev, activeGroupId, corpCodes));
    setAddToGroupOpen(false);
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
              <div className="page__section-actions">
                <button
                  type="button"
                  className="page__add-toggle"
                  onClick={() => setGroupModalOpen(true)}
                >
                  + 그룹 추가
                </button>
                <button
                  type="button"
                  className="page__add-toggle"
                  onClick={() => setAddPanelOpen((v) => !v)}
                >
                  {isAddPanelOpen ? "닫기" : "+ 종목 추가"}
                </button>
              </div>
            </div>

            {isAddPanelOpen && (
              <AddCompanyPanel
                existingCorpCodes={summaries?.map((s) => s.company.corpCode) ?? []}
                onAdded={handleAdded}
                onClose={() => setAddPanelOpen(false)}
              />
            )}

            {groups.length > 0 && (
              <div className="group-tabs">
                <button
                  type="button"
                  className={`group-tabs__tab${activeGroupId === null ? " group-tabs__tab--active" : ""}`}
                  onClick={() => setActiveGroupId(null)}
                >
                  전체
                </button>
                {groups.map((group) => (
                  <span
                    key={group.id}
                    className={`group-tabs__tab${activeGroupId === group.id ? " group-tabs__tab--active" : ""}`}
                  >
                    <button type="button" onClick={() => setActiveGroupId(group.id)}>
                      {group.name} <span className="group-tabs__count">{group.corpCodes.length}</span>
                    </button>
                    <button
                      type="button"
                      className="group-tabs__remove"
                      aria-label={`${group.name} 그룹 삭제`}
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {activeGroup && visibleSummaries?.length === 0 ? (
              <p className="watchlist-empty">"{activeGroup.name}" 그룹에 담긴 종목이 없어요</p>
            ) : (
              <ul className="watchlist" key={`${activeGroupId ?? "all"}-${watchlistPage}`}>
                {pagedSummaries?.map(({ company, riskFlags }) => (
                  <WatchlistRow
                    key={company.corpCode}
                    company={company}
                    flags={riskFlags}
                    selected={company.corpCode === selectedCorpCode}
                    onSelect={() => setSelectedCorpCode(company.corpCode)}
                    onRemove={() => handleRemove(company.corpCode)}
                  />
                ))}
              </ul>
            )}

            {watchlistPageCount > 1 && (
              <div className="watchlist-pagination">
                <button
                  type="button"
                  className="watchlist-pagination__button"
                  disabled={watchlistPage === 0}
                  onClick={() => setWatchlistPage((p) => Math.max(0, p - 1))}
                >
                  이전
                </button>
                <span className="watchlist-pagination__status">
                  {watchlistPage + 1} / {watchlistPageCount}
                </span>
                <button
                  type="button"
                  className="watchlist-pagination__button"
                  disabled={watchlistPage >= watchlistPageCount - 1}
                  onClick={() => setWatchlistPage((p) => Math.min(watchlistPageCount - 1, p + 1))}
                >
                  다음
                </button>
              </div>
            )}

            {activeGroup &&
              (isAddToGroupOpen ? (
                <AddToGroupPanel
                  groupName={activeGroup.name}
                  candidates={
                    summaries
                      ?.map((s) => s.company)
                      .filter((c) => !activeGroup.corpCodes.includes(c.corpCode)) ?? []
                  }
                  onAdd={handleAddToGroup}
                  onClose={() => setAddToGroupOpen(false)}
                />
              ) : (
                <button
                  type="button"
                  className="watchlist-add-to-group"
                  onClick={() => setAddToGroupOpen(true)}
                >
                  + 이 그룹에 종목 추가
                </button>
              ))}
          </section>

          {selectedCompany && (
            <section className="page__section" key={selectedCompany.corpCode}>
              <h2>
                선택한 종목 리스크 상세
                {selectedFlags.length > 1 && (
                  <span className="page__section-count"> ({selectedFlags.length}건)</span>
                )}
              </h2>
              {selectedFlags.length > 0 ? (
                <div className="risk-card-list">
                  {selectedFlags.map((flag) => (
                    <RiskCard
                      key={flag.id}
                      flag={flag}
                      corpName={selectedCompany.corpName}
                      corpCode={selectedCompany.corpCode}
                    />
                  ))}
                </div>
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

      {isGroupModalOpen && (
        <GroupModal
          companies={summaries?.map((s) => s.company) ?? []}
          onCreate={handleCreateGroup}
          onClose={() => setGroupModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
