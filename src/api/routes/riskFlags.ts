import { Router } from "express";
import type { RiskSeverity, RiskType } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { errorBody, ok } from "../response.js";

export const riskFlagsRouter = Router();

// GET /api/risk-flags?riskType=&severity=&corpCode=&limit=&offset=
riskFlagsRouter.get("/risk-flags", async (req, res) => {
  const { riskType, severity, corpCode } = req.query;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const validRiskTypes = ["audit_opinion_adverse", "embezzlement", "litigation", "management_designation", "not_applicable"];
  const validSeverities = ["low", "medium", "high"];

  if (typeof riskType === "string" && !validRiskTypes.includes(riskType)) {
    res.status(400).json(errorBody(`riskType은 ${validRiskTypes.join(", ")} 중 하나여야 합니다.`));
    return;
  }
  if (typeof severity === "string" && !validSeverities.includes(severity)) {
    res.status(400).json(errorBody(`severity는 ${validSeverities.join(", ")} 중 하나여야 합니다.`));
    return;
  }

  const riskFlags = await prisma.riskFlag.findMany({
    where: {
      ...(typeof riskType === "string" ? { riskType: riskType as RiskType } : {}),
      ...(typeof severity === "string" ? { severity: severity as RiskSeverity } : {}),
      ...(typeof corpCode === "string" ? { disclosure: { corpCode } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      disclosure: {
        select: {
          rceptNo: true,
          reportNm: true,
          rceptDt: true,
          corpCode: true,
          company: { select: { corpName: true } },
        },
      },
    },
  });

  res.json(ok(riskFlags, { limit, offset }));
});
