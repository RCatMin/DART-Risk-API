import type { Job } from "bullmq";
import { confirmWithGemini } from "../../ai/geminiClassify.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { evaluateRisk } from "../../risk/rules.js";
import type { ClassifyJobData } from "../queues.js";

// 룰 엔진이 1차로 걸러낸 후보가 있을 때만 Gemini로 재확인한다(하이브리드) — 후보가 없는
// 공시는 애초에 리스크로 볼 근거가 없으므로 AI 호출 자체를 안 해서 비용/호출량을 최소화한다.
export async function processClassifyJob(job: Job<ClassifyJobData>) {
  const disclosure = await prisma.disclosure.findUniqueOrThrow({
    where: { id: job.data.disclosureId },
    include: { company: { select: { corpName: true } } },
  });

  const ruleFindings = evaluateRisk(disclosure.rawText ?? "");

  let findings = ruleFindings;
  let aiConfirmed = false;

  if (ruleFindings.length > 0 && process.env.GEMINI_API_KEY) {
    try {
      findings = await confirmWithGemini(
        { corpName: disclosure.company.corpName, reportNm: disclosure.reportNm },
        ruleFindings,
      );
      aiConfirmed = true;
    } catch (err) {
      logger.error({ err, disclosureId: disclosure.id }, "Gemini 재확인 실패 — 룰 엔진 결과로 대체");
      findings = ruleFindings;
    }
  }

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
        summary: aiConfirmed
          ? "[Gemini 확인] 룰 엔진 후보를 재검토한 결과 실제 리스크로 보기 어려움(보일러플레이트 등)"
          : "키워드 매칭 없음 — 리스크 관련 문구 미발견",
        confidence: 0.9,
        sourceSnippet: "",
      },
    });
  }

  return { findings: findings.length, aiConfirmed };
}
