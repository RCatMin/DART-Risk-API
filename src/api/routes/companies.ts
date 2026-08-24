import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { errorBody, ok } from "../response.js";

export const companiesRouter = Router();

// GET /api/companies?isWatched=true|false|all
companiesRouter.get("/companies", async (req, res) => {
  const isWatchedParam = req.query.isWatched;
  const where = isWatchedParam === "all" ? {} : { isWatched: isWatchedParam !== "false" };

  const companies = await prisma.company.findMany({
    where,
    orderBy: { corpName: "asc" },
  });

  res.json(ok(companies));
});

// GET /api/companies/:corpCode/disclosures?limit=&offset=
companiesRouter.get("/companies/:corpCode/disclosures", async (req, res) => {
  const { corpCode } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const company = await prisma.company.findUnique({ where: { corpCode } });
  if (!company) {
    res.status(404).json(errorBody(`corp_code=${corpCode} 기업을 찾을 수 없습니다.`));
    return;
  }

  const disclosures = await prisma.disclosure.findMany({
    where: { corpCode },
    orderBy: { rceptDt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      rceptNo: true,
      reportNm: true,
      rceptDt: true,
      status: true,
      _count: { select: { riskFlags: true } },
    },
  });

  res.json(ok(disclosures, { company: { corpCode: company.corpCode, corpName: company.corpName }, limit, offset }));
});
