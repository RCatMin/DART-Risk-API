import type { MarketIndex, StockPrice } from "../lib/marketMock";
import "./MarketPanel.css";

// 색만으로 등락을 구분하지 않도록 화살표를 함께 쓴다(disclaimer-chip과 같은 원칙).
function formatChange(changePercent: number): string {
  if (changePercent > 0) return `▲ ${changePercent.toFixed(2)}%`;
  if (changePercent < 0) return `▼ ${Math.abs(changePercent).toFixed(2)}%`;
  return "− 0.00%";
}

function directionClass(changePercent: number): string {
  if (changePercent > 0) return "market-change--up";
  if (changePercent < 0) return "market-change--down";
  return "market-change--flat";
}

interface MarketPanelProps {
  indices: MarketIndex[];
  watchlistPrices: StockPrice[];
  isMock: boolean;
}

// 워치리스트 리스크 색(HIGH/MEDIUM/LOW)과 겹치지 않도록, 시세 등락은 국내 증시 관례(상승 빨강/
// 하락 파랑)를 그대로 쓰되 채도를 낮춰 risk-badge와 구분되게 했다.
export function MarketPanel({ indices, watchlistPrices, isMock }: MarketPanelProps) {
  return (
    <section className="market-panel">
      <header className="market-panel__header">
        <h2>시장</h2>
        {isMock && <span className="market-panel__mock-note">목업 데이터</span>}
      </header>

      <div className="market-panel__indices">
        {indices.map((index) => (
          <div key={index.id} className="market-index-card">
            <span className="market-index-card__name">{index.name}</span>
            <span className="market-index-card__value">
              {index.value.toLocaleString("ko-KR", { minimumFractionDigits: 2 })}
            </span>
            <span className={`market-change ${directionClass(index.changePercent)}`}>
              {formatChange(index.changePercent)}
            </span>
          </div>
        ))}
      </div>

      <ul className="market-panel__watchlist">
        {watchlistPrices.map((stock) => (
          <li key={stock.corpCode} className="market-stock-row">
            <span className="market-stock-row__name">{stock.corpName}</span>
            <span className="market-stock-row__price">
              ₩{stock.price.toLocaleString("ko-KR")}
            </span>
            <span className={`market-change ${directionClass(stock.changePercent)}`}>
              {formatChange(stock.changePercent)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
