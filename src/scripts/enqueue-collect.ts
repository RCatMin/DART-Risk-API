import { prisma } from "../lib/prisma.js";
import { collectQueue } from "../queue/queues.js";

async function main() {
  const companies = await prisma.company.findMany({ where: { isWatched: true } });
  console.log(`워치리스트 ${companies.length}개 기업의 collect job을 큐에 등록합니다.`);

  for (const company of companies) {
    await collectQueue.add("collect", { corpCode: company.corpCode });
  }

  console.log(`${companies.length}건 등록 완료. 워커(npm run workers)가 실행 중이어야 처리됩니다.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
