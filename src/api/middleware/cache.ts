import type { NextFunction, Request, Response } from "express";
import { redisConnection } from "../../queue/connection.js";

// 응답을 Redis에 잠깐 캐싱하는 미들웨어. 조회 API라 쓰기가 없어서 TTL 하나로 충분하다고 판단.
const DEFAULT_TTL_SECONDS = 30;

export function cacheResponse(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  return async (req: Request, res: Response, next: NextFunction) => {
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
          .catch((err) => console.error("[cache] 캐시 저장 실패:", err));
      }
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}
