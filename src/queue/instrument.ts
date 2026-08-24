import type { Job } from "bullmq";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

// 워커 processor를 감싸서 시도마다(재시도 포함) 구조화 로그 + JobLog 레코드를 남긴다.
// 재시도 여부 판단(dead-letter)은 별도 핸들러(dead-letter.ts) 담당, 여기서는 순수 실행 기록만 남긴다.
export function withJobLog<D, R>(jobType: string, processor: (job: Job<D>) => Promise<R>) {
  const log = logger.child({ jobType });

  return async (job: Job<D>): Promise<R> => {
    const start = performance.now();
    log.info({ jobId: job.id, data: job.data }, "job 시작");

    // 실제 job 실행과 JobLog 기록을 분리한다 — JobLog 기록 자체가 실패해도
    // (예: DB 순단) 정상적으로 끝난 job이 실패로 오인되어 재시도되면 안 된다.
    let result: R;
    try {
      result = await processor(job);
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error({ jobId: job.id, durationMs, err: error }, "job 실패");

      try {
        await prisma.jobLog.create({
          data: { jobId: String(job.id), jobType, status: "failed", durationMs, errorMessage },
        });
      } catch (dbError) {
        log.error({ jobId: job.id, dbError }, "JobLog 기록 실패");
      }

      throw error;
    }

    const durationMs = Math.round(performance.now() - start);
    log.info({ jobId: job.id, durationMs }, "job 완료");

    try {
      await prisma.jobLog.create({
        data: { jobId: String(job.id), jobType, status: "success", durationMs },
      });
    } catch (dbError) {
      log.error({ jobId: job.id, dbError }, "JobLog 기록 실패");
    }

    return result;
  };
}
