import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const QUEUE_NAMES = {
  collect: "collect-disclosures",
  extract: "extract-text",
  classify: "classify-risk",
  deadLetter: "dead-letter",
} as const;

// DART API 호출 실패(네트워크 오류, 일시적 rate limit 등)를 감안한 재시도 정책.
// 5s -> 10s -> 20s로 늘어나며 총 3회 시도.
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: false, // dead-letter 판단 로직이 참조할 수 있게 실패 잡은 남겨둔다
};

export interface CollectJobData {
  corpCode: string;
}

export interface ExtractJobData {
  disclosureId: number;
}

export interface ClassifyJobData {
  disclosureId: number;
}

export const collectQueue = new Queue<CollectJobData>(QUEUE_NAMES.collect, {
  connection: redisConnection,
  defaultJobOptions,
});

export const extractQueue = new Queue<ExtractJobData>(QUEUE_NAMES.extract, {
  connection: redisConnection,
  defaultJobOptions,
});

export const classifyQueue = new Queue<ClassifyJobData>(QUEUE_NAMES.classify, {
  connection: redisConnection,
  defaultJobOptions,
});

export const deadLetterQueue = new Queue(QUEUE_NAMES.deadLetter, { connection: redisConnection });
