import { prisma } from "../lib/prisma.js";
import { evaluateRisk } from "../risk/rules.js";

async function main() {
  const limitArg = Number(process.argv[2]);
  const limit = Number.isFinite(limitArg) ? limitArg : undefined;

  const targets = await prisma.disclosure.findMany({
    where: { status: "done", rawText: { not: null }, riskFlags: { none: {} } },
    orderBy: { rceptDt: "desc" },
    ...(limit === undefined ? {} : { take: limit }),
  });

  console.log(`리스크 분류 대상 공시 ${targets.length}건`);

  let flagged = 0;
  let clean = 0;

  for (const disclosure of targets) {
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
      console.log(`[감지 ${findings.length}건] ${disclosure.reportNm} (${disclosure.rceptNo}) — ${findings.map((f) => f.riskType).join(", ")}`);
      flagged++;
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
      clean++;
    }
  }

  console.log(`완료: 리스크 감지 ${flagged}건, 해당없음 ${clean}건`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
