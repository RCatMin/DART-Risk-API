import { fetchDisclosures } from "../dart/disclosures.js";
import { prisma } from "../lib/prisma.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const companies = await prisma.company.findMany({ where: { isWatched: true } });
  console.log(`워치리스트 ${companies.length}개 기업의 공시를 조회합니다.`);

  const endDe = formatDate(new Date());
  const bgnDate = new Date();
  bgnDate.setFullYear(bgnDate.getFullYear() - 1);
  const bgnDe = formatDate(bgnDate);

  let totalFetched = 0;
  let totalInserted = 0;

  for (const company of companies) {
    const disclosures = await fetchDisclosures({ corpCode: company.corpCode, bgnDe, endDe });
    totalFetched += disclosures.length;

    if (disclosures.length > 0) {
      const result = await prisma.disclosure.createMany({
        data: disclosures.map((d) => ({
          rceptNo: d.rceptNo,
          corpCode: d.corpCode,
          reportNm: d.reportNm,
          rceptDt: new Date(`${d.rceptDt.slice(0, 4)}-${d.rceptDt.slice(4, 6)}-${d.rceptDt.slice(6, 8)}`),
        })),
        skipDuplicates: true,
      });
      totalInserted += result.count;
    }

    // DART API에 과도한 연속 요청을 피하기 위한 최소 간격
    await sleep(150);
  }

  console.log(
    `조회된 공시 ${totalFetched}건 중 신규 ${totalInserted}건 저장 (중복 ${totalFetched - totalInserted}건 스킵)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
