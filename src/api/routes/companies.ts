import { Router } from "express";
import { fetchCorpCodeMap, searchCorpCode } from "../../dart/corpCode.js";
import { prisma } from "../../lib/prisma.js";
import { collectQueue } from "../../queue/queues.js";
import { invalidateCache } from "../middleware/cache.js";
import { errorBody, ok } from "../response.js";

export const companiesRouter = Router();

// GET /companies가 쿼리스트링별로 캐시되므로, 쓰기 후엔 가능한 변형을 전부 지운다.
const COMPANIES_LIST_CACHE_PATHS = [
  "/api/companies",
  "/api/companies?isWatched=true",
  "/api/companies?isWatched=false",
  "/api/companies?isWatched=all",
  "/api/companies/risk-summary",
  "/api/companies/risk-summary?isWatched=true",
  "/api/companies/risk-summary?isWatched=false",
  "/api/companies/risk-summary?isWatched=all",
];

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

// GET /api/companies/search?q= — 워치리스트에 추가할 종목을 DART 전체 상장사 중에서 찾는다.
// DB가 아니라 DART corpCode.xml을 직접 조회 (아직 우리 DB에 없는 종목도 찾아야 하므로).
companiesRouter.get("/companies/search", async (req, res) => {
  const q = req.query.q;
  if (typeof q !== "string" || q.trim().length === 0) {
    res.status(400).json(errorBody("q 쿼리 파라미터가 필요합니다."));
    return;
  }

  const corpCodeMap = await fetchCorpCodeMap();
  const results = searchCorpCode(corpCodeMap, q);

  res.json(ok(results));
});

// GET /api/companies/risk-summary?isWatched=true|false|all
// 회사별 "현재 리스크 상태"를 유형별로 하나씩(그 유형 내에서 가장 심각하고, 동률이면 가장 최근인 것)
// 계산해서 돌려준다. 리스크 유형이 5개에서 7개로 늘어난 뒤로, 한 회사가 서로 다른 유형(예: 소송 +
// 지분희석)의 리스크를 동시에 가질 수 있게 됐다 — "전체 중 1건만" 고르면 심각도가 같은 다른 유형이
// 임의로 가려지는 문제가 생겨서, 유형별로 남긴다.
// /api/risk-flags?limit=N처럼 전체를 최신순으로 잘라서 회사별로 매핑하면, 데이터가 많아질수록
// 특정 회사의 실제 리스크가 다른 회사(또는 같은 회사의 다른 공시)의 최신 not_applicable 레코드에
// 밀려 잘려나가는 문제가 생긴다 — 그래서 회사마다 독립적으로 쿼리한다.
companiesRouter.get("/companies/risk-summary", async (req, res) => {
  const isWatchedParam = req.query.isWatched;
  const where = isWatchedParam === "all" ? {} : { isWatched: isWatchedParam !== "false" };

  const companies = await prisma.company.findMany({ where, orderBy: { corpName: "asc" } });

  const summaries = await Promise.all(
    companies.map(async (company) => {
      const flags = await prisma.riskFlag.findMany({
        where: { disclosure: { corpCode: company.corpCode }, riskType: { not: "not_applicable" } },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        include: {
          disclosure: {
            select: { rceptNo: true, reportNm: true, rceptDt: true, corpCode: true },
          },
        },
      });

      // 이미 severity desc, createdAt desc로 정렬돼 있으니, 유형별로 처음 나온 것이 그 유형의 대표 플래그다.
      const byType = new Map<string, (typeof flags)[number]>();
      for (const flag of flags) {
        if (!byType.has(flag.riskType)) byType.set(flag.riskType, flag);
      }

      return { company, riskFlags: [...byType.values()] };
    }),
  );

  res.json(ok(summaries));
});

// POST /api/companies — 워치리스트에 종목 추가 (신규든 기존이든).
// body: { corpCode, corpName, stockCode } — /companies/search 결과를 그대로 전달.
companiesRouter.post("/companies", async (req, res) => {
  const { corpCode, corpName, stockCode } = req.body ?? {};
  if (!corpCode || !corpName || !stockCode) {
    res.status(400).json(errorBody("corpCode, corpName, stockCode가 모두 필요합니다."));
    return;
  }

  const company = await prisma.company.upsert({
    where: { corpCode },
    create: { corpCode, corpName, stockCode, isWatched: true },
    update: { isWatched: true },
  });

  // 추가 즉시 최근 공시를 받아오도록 collect job 등록
  await collectQueue.add("collect", { corpCode });
  await invalidateCache(COMPANIES_LIST_CACHE_PATHS);

  res.status(201).json(ok(company));
});

// PATCH /api/companies/:corpCode — 워치리스트 제외(isWatched=false) 또는 재포함
companiesRouter.patch("/companies/:corpCode", async (req, res) => {
  const { corpCode } = req.params;
  const { isWatched } = req.body ?? {};
  if (typeof isWatched !== "boolean") {
    res.status(400).json(errorBody("isWatched는 boolean이어야 합니다."));
    return;
  }

  const existing = await prisma.company.findUnique({ where: { corpCode } });
  if (!existing) {
    res.status(404).json(errorBody(`corp_code=${corpCode} 기업을 찾을 수 없습니다.`));
    return;
  }

  const company = await prisma.company.update({ where: { corpCode }, data: { isWatched } });

  // 꺼져 있던 종목을 다시 켜는 경우, 그 사이 놓쳤을 공시를 받아오도록 collect job 등록
  if (isWatched && !existing.isWatched) {
    await collectQueue.add("collect", { corpCode });
  }
  await invalidateCache(COMPANIES_LIST_CACHE_PATHS);

  res.json(ok(company));
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
