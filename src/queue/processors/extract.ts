import type { Job } from "bullmq";
import { fetchReportText } from "../../dart/document.js";
import { prisma } from "../../lib/prisma.js";
import { classifyQueue, type ExtractJobData } from "../queues.js";

export async function processExtractJob(job: Job<ExtractJobData>) {
  const disclosure = await prisma.disclosure.findUniqueOrThrow({
    where: { id: job.data.disclosureId },
  });

  await prisma.disclosure.update({ where: { id: disclosure.id }, data: { status: "processing" } });

  const text = await fetchReportText(disclosure.rceptNo, disclosure.reportNm);

  await prisma.disclosure.update({
    where: { id: disclosure.id },
    data: { rawText: text, status: "done" },
  });

  await classifyQueue.add("classify", { disclosureId: disclosure.id });

  return { textLength: text.length };
}
