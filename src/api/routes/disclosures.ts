import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { errorBody, ok } from "../response.js";

export const disclosuresRouter = Router();

// GET /api/disclosures/:id?includeRawText=true
// raw_text는 최대 1MB 이상일 수 있어서 기본 응답에서는 빼고, 필요할 때만 포함시킨다.
disclosuresRouter.get("/disclosures/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json(errorBody("id는 정수여야 합니다."));
    return;
  }

  const includeRawText = req.query.includeRawText === "true";

  const disclosure = await prisma.disclosure.findUnique({
    where: { id },
    include: {
      company: { select: { corpCode: true, corpName: true, stockCode: true } },
      riskFlags: { orderBy: { severity: "desc" } },
    },
  });

  if (!disclosure) {
    res.status(404).json(errorBody(`id=${id} 공시를 찾을 수 없습니다.`));
    return;
  }

  const { rawText, ...rest } = disclosure;
  res.json(ok(includeRawText ? disclosure : rest));
});
