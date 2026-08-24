import express from "express";
import { requireApiKey } from "./middleware/auth.js";
import { cacheResponse } from "./middleware/cache.js";
import { companiesRouter } from "./routes/companies.js";
import { disclosuresRouter } from "./routes/disclosures.js";
import { riskFlagsRouter } from "./routes/riskFlags.js";
import { errorBody } from "./response.js";

export function createApp() {
  const app = express();

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // 조회 API는 전부 API 키 필요 + 캐시 적용
  app.use("/api", requireApiKey, cacheResponse());
  app.use("/api", companiesRouter);
  app.use("/api", disclosuresRouter);
  app.use("/api", riskFlagsRouter);

  app.use((_req, res) => {
    res.status(404).json(errorBody("존재하지 않는 경로입니다."));
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] 처리되지 않은 에러:", err);
    res.status(500).json(errorBody("서버 내부 오류가 발생했습니다."));
  });

  return app;
}
