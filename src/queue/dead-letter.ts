import type { Job, Worker } from "bullmq";
import { deadLetterQueue } from "./queues.js";

// 워커의 재시도가 전부 소진된(attemptsMade === 설정된 attempts) job을 dead-letter 큐로 옮긴다.
export function attachDeadLetterHandler(
  worker: Worker,
  queueName: string,
  onFinalFailure?: (job: Job) => Promise<void>,
) {
  worker.on("failed", async (job, error) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;

    if (!exhausted) {
      console.warn(`[retry] ${queueName} job ${job.id} 실패 (attempt ${job.attemptsMade}/${maxAttempts}) — 재시도 예정: ${error.message}`);
      return;
    }

    console.error(`[dead-letter] ${queueName} job ${job.id} 최종 실패 (attempts=${job.attemptsMade}) — dead-letter로 이동: ${error.message}`);

    // dead-letter 기록/후처리 자체가 실패해도 워커 프로세스가 죽으면 다른 job까지 전부 멈추므로,
    // 여기서는 절대 throw하지 않고 로그만 남긴다.
    try {
      await deadLetterQueue.add("dead-letter", {
        originalQueue: queueName,
        originalJobId: job.id,
        data: job.data,
        failedReason: error.message,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
    } catch (deadLetterError) {
      console.error(`[dead-letter] ${queueName} job ${job.id} dead-letter 기록 실패:`, deadLetterError);
    }

    if (onFinalFailure) {
      try {
        await onFinalFailure(job);
      } catch (callbackError) {
        console.error(`[dead-letter] ${queueName} job ${job.id} onFinalFailure 콜백 실패:`, callbackError);
      }
    }
  });
}
