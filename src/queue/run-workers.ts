import { Worker } from "bullmq";
import { logger } from "../lib/logger.js";
import { redisConnection } from "./connection.js";
import { attachDeadLetterHandler } from "./dead-letter.js";
import { withJobLog } from "./instrument.js";
import { processClassifyJob } from "./processors/classify.js";
import { processCollectJob } from "./processors/collect.js";
import { processExtractJob } from "./processors/extract.js";
import { prisma } from "../lib/prisma.js";
import { QUEUE_NAMES } from "./queues.js";

// DART API를 호출하는 collect/extract는 부담을 줄이려고 동시성을 낮게,
// 순수 로컬 연산인 classify는 높게 둔다.
const collectWorker = new Worker(QUEUE_NAMES.collect, withJobLog("collect", processCollectJob), { connection: redisConnection, concurrency: 2 });
const extractWorker = new Worker(QUEUE_NAMES.extract, withJobLog("extract", processExtractJob), { connection: redisConnection, concurrency: 2 });
const classifyWorker = new Worker(QUEUE_NAMES.classify, withJobLog("classify", processClassifyJob), { connection: redisConnection, concurrency: 5 });

attachDeadLetterHandler(collectWorker, QUEUE_NAMES.collect);
attachDeadLetterHandler(extractWorker, QUEUE_NAMES.extract, async (job) => {
  await prisma.disclosure.update({ where: { id: job.data.disclosureId }, data: { status: "failed" } });
});
attachDeadLetterHandler(classifyWorker, QUEUE_NAMES.classify);

for (const [label, worker] of [
  ["collect", collectWorker],
  ["extract", extractWorker],
  ["classify", classifyWorker],
] as const) {
  worker.on("completed", (job) => logger.info({ jobType: label, jobId: job.id, result: job.returnvalue }, "job 완료 이벤트"));
}

logger.info("워커 3개 시작: collect-disclosures, extract-text, classify-risk (Ctrl+C로 종료)");

// 예상치 못한 예외 하나가 워커 프로세스 전체를 죽여서 나머지 job까지 멈추는 걸 막는 안전망.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "처리되지 않은 rejection");
});
process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "처리되지 않은 예외");
});

async function shutdown() {
  logger.info("워커 종료 중...");
  await Promise.all([collectWorker.close(), extractWorker.close(), classifyWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
