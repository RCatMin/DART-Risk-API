import { useState } from "react";
import type { Company } from "../lib/api";
import "./AddToGroupPanel.css";

interface AddToGroupPanelProps {
  groupName: string;
  candidates: Company[];
  onAdd: (corpCodes: string[]) => void;
  onClose: () => void;
}

// DESIGN.md에는 아직 없는 컴포넌트 — 그룹 생성 후에도 종목을 추가로 편입할 수 있게 하는
// 패널. GroupModal(그룹 최초 생성)과 달리 워치리스트 목록 맨 아래에 인라인으로 펼쳐진다.
// 다음 omd:learn 때 components-states에 정식 등록 필요.
export function AddToGroupPanel({ groupName, candidates, onAdd, onClose }: AddToGroupPanelProps) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const visibleCandidates = candidates.filter((c) =>
    c.corpName.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  function toggle(corpCode: string) {
    setSelected((prev) => (prev.includes(corpCode) ? prev.filter((c) => c !== corpCode) : [...prev, corpCode]));
  }

  function handleSubmit() {
    if (selected.length === 0) return;
    onAdd(selected);
  }

  return (
    <div className="add-to-group-panel">
      <div className="add-to-group-panel__header">
        <span>"{groupName}"에 종목 추가</span>
        <button type="button" className="add-to-group-panel__close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="add-to-group-panel__empty">워치리스트의 모든 종목이 이미 이 그룹에 있어요</p>
      ) : (
        <>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="종목 이름으로 찾기"
            className="add-to-group-panel__filter-input"
            autoFocus
          />

          <ul className="add-to-group-panel__list">
            {visibleCandidates.map((company) => (
              <li key={company.corpCode} className="add-to-group-panel__item">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(company.corpCode)}
                    onChange={() => toggle(company.corpCode)}
                  />
                  <span className="add-to-group-panel__item-name">
                    {company.corpName}
                    <span>{company.stockCode}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="add-to-group-panel__footer">
            <span className="add-to-group-panel__count">{selected.length}개 선택</span>
            <button
              type="button"
              className="add-to-group-panel__submit"
              disabled={selected.length === 0}
              onClick={handleSubmit}
            >
              추가
            </button>
          </div>
        </>
      )}
    </div>
  );
}
