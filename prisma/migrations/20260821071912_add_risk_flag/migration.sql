-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('audit_opinion_adverse', 'embezzlement', 'litigation', 'management_designation', 'not_applicable');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "risk_flags" (
    "id" SERIAL NOT NULL,
    "disclosure_id" INTEGER NOT NULL,
    "risk_type" "RiskType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source_snippet" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_flags_disclosure_id_idx" ON "risk_flags"("disclosure_id");

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_disclosure_id_fkey" FOREIGN KEY ("disclosure_id") REFERENCES "disclosures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
