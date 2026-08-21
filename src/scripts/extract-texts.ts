import { fetchReportText } from "../dart/document.js";
import { prisma } from "../lib/prisma.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limitArg = Number(process.argv[2]);
  const limit = Number.isFinite(limitArg) ? limitArg : undefined;

  const targets = await prisma.disclosure.findMany({
    where: { status: "pending" },
    orderBy: { rceptDt: "desc" },
    ...(limit === undefined ? {} : { take: limit }),
  });

  console.log(`텍스트 추출 대상 공시 ${targets.length}건`);

  let done = 0;
  let failed = 0;

  for (const disclosure of targets) {
    try {
      await prisma.disclosure.update({ where: { id: disclosure.id }, data: { status: "processing" } });
      const text = await fetchReportText(disclosure.rceptNo, disclosure.reportNm);
      await prisma.disclosure.update({
        where: { id: disclosure.id },
        data: { rawText: text, status: "done" },
      });
      console.log(`완료: ${disclosure.reportNm} (${disclosure.rceptNo}) — ${text.length.toLocaleString()}자`);
      done++;
    } catch (err) {
      await prisma.disclosure.update({ where: { id: disclosure.id }, data: { status: "failed" } });
      console.error(`실패: ${disclosure.reportNm} (${disclosure.rceptNo})`, err);
      failed++;
    }

    // DART 공시서류원본 API에 과도한 연속 요청을 피하기 위한 최소 간격
    await sleep(200);
  }

  console.log(`완료 ${done}건, 실패 ${failed}건`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
