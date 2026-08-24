import express from "express";
import { pinoHttp } from "pino-http";
import { logger } from "../lib/logger.js";
import { requireApiKey } from "./middleware/auth.js";
import { cacheResponse } from "./middleware/cache.js";
import { companiesRouter } from "./routes/companies.js";
import { disclosuresRouter } from "./routes/disclosures.js";
import { riskFlagsRouter } from "./routes/riskFlags.js";
import { errorBody } from "./response.js";

export function createApp() {
  const app = express();

  // 모든 요청을 구조화 로그로 남긴다 (method/path/status/응답시간).
  // health check는 자주 호출되어 로그가 묻히므로 제외.
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/health" },
      // API 키가 로그에 평문으로 남지 않도록 마스킹
      redact: { paths: ['req.headers["x-api-key"]'], censor: "***" },
    }),
  );

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // 조회 API는 전부 API 키 필요 + 캐시 적용
  app.use("/api", requireApiKey, cacheResponse());
  app.use("/api", companiesRouter);
  app.use("/api", disclosuresRouter);
  app.use("/api", riskFlagsRouter);

  app.use((_req, res) => {
    res.status(404).json(errorBody("존재하지 않는 경로입니다."));
  });

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log.error({ err }, "처리되지 않은 에러");
    res.status(500).json(errorBody("서버 내부 오류가 발생했습니다."));
  });

  return app;
}
