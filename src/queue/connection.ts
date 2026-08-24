import { Redis } from "ioredis";

// BullMQ가 blocking command(BRPOPLPUSH 등)를 쓰기 때문에 maxRetriesPerRequest는 반드시 null이어야 함.
export const redisConnection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
