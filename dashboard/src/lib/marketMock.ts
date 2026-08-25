// 실시간 시세 백엔드가 아직 없어 임시로 만든 목업입니다.
// 백엔드 시세 API가 준비되면 이 파일을 지우고 lib/api.ts에 fetchMarketIndices/fetchWatchlistPrices를 추가하세요.

export interface MarketIndex {
  id: "KOSPI" | "KOSDAQ";
  name: string;
  value: number;
  changePercent: number;
}

export interface StockPrice {
  corpCode: string;
  corpName: string;
  price: number;
  changePercent: number;
}

export const MOCK_INDICES: MarketIndex[] = [
  { id: "KOSPI", name: "코스피", value: 2650.32, changePercent: 0.42 },
  { id: "KOSDAQ", name: "코스닥", value: 845.1, changePercent: -0.18 },
];

export const MOCK_WATCHLIST_PRICES: StockPrice[] = [
  { corpCode: "00126380", corpName: "삼성전자", price: 71200, changePercent: 1.2 },
  { corpCode: "00164779", corpName: "SK하이닉스", price: 198500, changePercent: -0.8 },
  { corpCode: "00164742", corpName: "현대차", price: 245000, changePercent: 0.3 },
];
