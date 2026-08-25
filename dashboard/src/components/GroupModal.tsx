import { useState } from "react";
import type { Company } from "../lib/api";
import "./GroupModal.css";

interface GroupModalProps {
  companies: Company[];
  onCreate: (name: string, corpCodes: string[]) => void;
  onClose: () => void;
}

// DESIGN.md에는 아직 없는 컴포넌트 — 워치리스트 그룹(브라우저 로컬 전용) 생성용 팝업.
// 다음 omd:learn 때 components-states에 정식 등록 필요.
export function GroupModal({ companies, onCreate, onClose }: GroupModalProps) {
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const visibleCompanies = companies.filter((c) => c.corpName.toLowerCase().includes(filter.trim().toLowerCase()));

  function toggle(corpCode: string) {
    setSelected((prev) =>
      prev.includes(corpCode) ? prev.filter((c) => c !== corpCode) : [...prev, corpCode],
    );
  }

  function handleSubmit() {
    if (!name.trim() || selected.length === 0) return;
    onCreate(name.trim(), selected);
  }

  return (
    <div className="group-modal__backdrop" onClick={onClose}>
      <div
        className="group-modal"
        role="dialog"
        aria-modal="true"
        aria-label="워치리스트 그룹 추가"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="group-modal__header">
          <h3>그룹 추가</h3>
          <button type="button" className="group-modal__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="그룹 이름 (예: 반도체)"
          className="group-modal__name-input"
          autoFocus
        />

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="종목 이름으로 찾기"
          className="group-modal__filter-input"
        />

        <ul className="group-modal__list">
          {visibleCompanies.length === 0 && <li className="group-modal__empty">종목이 없어요</li>}
          {visibleCompanies.map((company) => (
            <li key={company.corpCode} className="group-modal__item">
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(company.corpCode)}
                  onChange={() => toggle(company.corpCode)}
                />
                <span className="group-modal__item-name">
                  {company.corpName}
                  <span>{company.stockCode}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="group-modal__footer">
          <span className="group-modal__count">{selected.length}개 선택</span>
          <div className="group-modal__actions">
            <button type="button" className="group-modal__cancel" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="group-modal__submit"
              disabled={!name.trim() || selected.length === 0}
              onClick={handleSubmit}
            >
              만들기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
