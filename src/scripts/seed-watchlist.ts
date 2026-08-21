import { fetchCorpCodeMap } from "../dart/corpCode.js";
import { prisma } from "../lib/prisma.js";
import { fetchTopMarketCap } from "../marketcap/dataGoKr.js";

const WATCHLIST_SIZE = 80;

async function main() {
  console.log(`시가총액 상위 ${WATCHLIST_SIZE}개 조회 중...`);
  const topStocks = await fetchTopMarketCap(WATCHLIST_SIZE);

  console.log("DART 고유번호 매핑 조회 중...");
  const corpCodeMap = await fetchCorpCodeMap();

  let registered = 0;
  let skipped = 0;
  for (const stock of topStocks) {
    const entry = corpCodeMap.get(stock.stockCode);
    if (!entry) {
      console.warn(`DART corp_code를 찾지 못해 건너뜀: ${stock.corpName} (${stock.stockCode})`);
      skipped++;
      continue;
    }
    await prisma.company.upsert({
      where: { corpCode: entry.corpCode },
      create: {
        corpCode: entry.corpCode,
        corpName: entry.corpName,
        stockCode: stock.stockCode,
        isWatched: true,
      },
      update: { isWatched: true },
    });
    registered++;
  }

  console.log(`완료: ${registered}개 등록, ${skipped}개 건너뜀`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
