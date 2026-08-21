-- CreateEnum
CREATE TYPE "DisclosureStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "companies" (
    "corp_code" TEXT NOT NULL,
    "corp_name" TEXT NOT NULL,
    "stock_code" TEXT NOT NULL,
    "is_watched" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("corp_code")
);

-- CreateTable
CREATE TABLE "disclosures" (
    "id" SERIAL NOT NULL,
    "rcept_no" TEXT NOT NULL,
    "corp_code" TEXT NOT NULL,
    "report_nm" TEXT NOT NULL,
    "rcept_dt" TIMESTAMP(3) NOT NULL,
    "raw_text" TEXT,
    "status" "DisclosureStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_stock_code_key" ON "companies"("stock_code");

-- CreateIndex
CREATE UNIQUE INDEX "disclosures_rcept_no_key" ON "disclosures"("rcept_no");

-- CreateIndex
CREATE INDEX "disclosures_corp_code_idx" ON "disclosures"("corp_code");

-- AddForeignKey
ALTER TABLE "disclosures" ADD CONSTRAINT "disclosures_corp_code_fkey" FOREIGN KEY ("corp_code") REFERENCES "companies"("corp_code") ON DELETE RESTRICT ON UPDATE CASCADE;
