-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "job_logs" (
    "id" SERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_logs_job_type_status_idx" ON "job_logs"("job_type", "status");
