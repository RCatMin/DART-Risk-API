import type { Job } from "bullmq";
import { fetchDisclosures } from "../../dart/disclosures.js";
import { prisma } from "../../lib/prisma.js";
import { extractQueue, type CollectJobData } from "../queues.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function processCollectJob(job: Job<CollectJobData>) {
  const { corpCode } = job.data;

  const endDe = formatDate(new Date());
  const bgnDate = new Date();
  bgnDate.setFullYear(bgnDate.getFullYear() - 1);
  const bgnDe = formatDate(bgnDate);

  const disclosures = await fetchDisclosures({ corpCode, bgnDe, endDe });

  if (disclosures.length > 0) {
    await prisma.disclosure.createMany({
      data: disclosures.map((d) => ({
        rceptNo: d.rceptNo,
        corpCode: d.corpCode,
        reportNm: d.reportNm,
        rceptDt: new Date(`${d.rceptDt.slice(0, 4)}-${d.rceptDt.slice(4, 6)}-${d.rceptDt.slice(6, 8)}`),
      })),
      skipDuplicates: true,
    });
  }

  // 새로 들어온 것뿐 아니라, 이전에 수집됐지만 아직 텍스트 추출 전인 공시까지 포함해서 체이닝
  const pending = await prisma.disclosure.findMany({
    where: { corpCode, status: "pending" },
    select: { id: true },
  });

  for (const disclosure of pending) {
    await extractQueue.add("extract", { disclosureId: disclosure.id });
  }

  return { fetched: disclosures.length, enqueuedExtract: pending.length };
}
