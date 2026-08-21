export interface MarketCapEntry {
  stockCode: string;
  corpName: string;
  market: "KOSPI" | "KOSDAQ";
  marketCap: bigint;
}

interface StockPriceItem {
  srtnCd: string;
  itmsNm: string;
  mrktCtg: string;
  mrktTotAmt: string;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchStockPriceInfo(basDt: string): Promise<StockPriceItem[]> {
  const serviceKey = process.env.PUBLIC_DATA_API_KEY;
  if (!serviceKey) throw new Error("PUBLIC_DATA_API_KEY가 설정되지 않았습니다.");

  const url = new URL(
    "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo",
  );
  // data.go.kr 서비스키는 발급 시점에 이미 URL 인코딩되어 있어서,
  // URLSearchParams가 다시 인코딩하면 이중 인코딩되어 인증이 깨진다. 디코딩 후 넘긴다.
  url.searchParams.set("serviceKey", decodeURIComponent(serviceKey));
  url.searchParams.set("resultType", "json");
  url.searchParams.set("basDt", basDt);
  url.searchParams.set("numOfRows", "10000");
  url.searchParams.set("pageNo", "1");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`data.go.kr 요청 실패: ${res.status}`);
  const json = await res.json();

  const header = json?.response?.header;
  if (header && header.resultCode !== "00") {
    throw new Error(`data.go.kr 오류: ${header.resultCode} ${header.resultMsg}`);
  }

  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// 데이터가 기준일 다음 영업일 오후에 갱신되므로, 당일 조회가 비어있을 수 있어
// 최근 영업일을 찾을 때까지 며칠 거슬러 올라간다.
export async function fetchTopMarketCap(limit: number): Promise<MarketCapEntry[]> {
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const items = await fetchStockPriceInfo(formatDate(date));
    if (items.length === 0) continue;

    return items
      .filter((item): item is StockPriceItem & { mrktCtg: "KOSPI" | "KOSDAQ" } =>
        item.mrktCtg === "KOSPI" || item.mrktCtg === "KOSDAQ",
      )
      .map((item) => ({
        stockCode: item.srtnCd,
        corpName: item.itmsNm,
        market: item.mrktCtg,
        marketCap: BigInt(item.mrktTotAmt || "0"),
      }))
      .sort((a, b) => (a.marketCap < b.marketCap ? 1 : a.marketCap > b.marketCap ? -1 : 0))
      .slice(0, limit);
  }
  throw new Error("최근 7일간 시세 데이터를 가져오지 못했습니다.");
}
