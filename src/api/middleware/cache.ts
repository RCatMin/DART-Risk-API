import type { NextFunction, Request, Response } from "express";
import { logger } from "../../lib/logger.js";
import { redisConnection } from "../../queue/connection.js";

// 응답을 Redis에 잠깐 캐싱하는 미들웨어.
const DEFAULT_TTL_SECONDS = 30;

export function cacheResponse(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // GET 이외의 요청(POST/PATCH 등 쓰기)은 캐시를 조회/저장하지 않는다.
    // 같은 URL을 GET과 함께 쓰는 라우트(예: POST /companies)가 생기면서,
    // 캐시 안 하면 쓰기 응답이 그대로 다음 GET 응답으로 잘못 캐시될 수 있다.
    if (req.method !== "GET") {
      next();
      return;
    }

    const key = `api-cache:${req.originalUrl}`;

    const cached = await redisConnection.get(key);
    if (cached) {
      const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
      res.setHeader("X-Cache", "HIT");
      res.status(status).json(body);
      return;
    }

    res.setHeader("X-Cache", "MISS");

    // res.json을 감싸서, 실제 응답이 나가는 시점에 그 내용을 캐시에 저장한다.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisConnection
          .set(key, JSON.stringify({ status: res.statusCode, body }), "EX", ttlSeconds)
          .catch((err) => logger.error({ err }, "캐시 저장 실패"));
      }
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}

// 쓰기 요청(POST/PATCH) 이후, 그 즉시 결과가 반영되어야 하는 GET 캐시를 지운다.
// 캐시 키가 쿼리스트링까지 포함한 전체 URL이라 자동 추론이 안 되므로, 지울 경로를 호출부에서 명시한다.
export async function invalidateCache(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((path) =>
      redisConnection.del(`api-cache:${path}`).catch((err) => logger.error({ err, path }, "캐시 무효화 실패")),
    ),
  );
}
