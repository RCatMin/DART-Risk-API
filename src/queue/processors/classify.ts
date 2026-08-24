import type { Job } from "bullmq";
import { prisma } from "../../lib/prisma.js";
import { evaluateRisk } from "../../risk/rules.js";
import type { ClassifyJobData } from "../queues.js";

export async function processClassifyJob(job: Job<ClassifyJobData>) {
  const disclosure = await prisma.disclosure.findUniqueOrThrow({
    where: { id: job.data.disclosureId },
  });

  const findings = evaluateRisk(disclosure.rawText ?? "");

  if (findings.length > 0) {
    await prisma.riskFlag.createMany({
      data: findings.map((f) => ({
        disclosureId: disclosure.id,
        riskType: f.riskType,
        severity: f.severity,
        summary: f.summary,
        confidence: f.confidence,
        sourceSnippet: f.sourceSnippet,
      })),
    });
  } else {
    await prisma.riskFlag.create({
      data: {
        disclosureId: disclosure.id,
        riskType: "not_applicable",
        severity: "low",
        summary: "키워드 매칭 없음 — 리스크 관련 문구 미발견",
        confidence: 0.9,
        sourceSnippet: "",
      },
    });
  }

  return { findings: findings.length };
}
