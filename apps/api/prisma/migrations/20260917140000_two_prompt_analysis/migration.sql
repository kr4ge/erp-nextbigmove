-- Two-prompt creative analysis.
--
-- Replaces the free-text analysis house rules with structured settings the
-- prompts read, adds per-product performance targets, and records which of the
-- two prompts judged each run.

-- CreateEnum
CREATE TYPE "CreativeFulfilmentModel" AS ENUM ('COD', 'PREPAID', 'MIXED');

-- How each store is paid. Defaults to COD because that is how this workspace
-- sells today; a prepaid brand is switched over in settings.
ALTER TABLE "creative_store_configs"
  ADD COLUMN "fulfilmentModel" "CreativeFulfilmentModel" NOT NULL DEFAULT 'COD';

-- Settings the prompts read, replacing the free-text house rules.
ALTER TABLE "creative_ai_policies"
  ADD COLUMN "analysisMarket" TEXT NOT NULL DEFAULT 'the Philippines',
  ADD COLUMN "analysisCurrency" TEXT NOT NULL DEFAULT 'PHP',
  ADD COLUMN "analysisLanguage" TEXT NOT NULL DEFAULT 'Taglish',
  ADD COLUMN "gateApproveScore" INTEGER NOT NULL DEFAULT 75,
  ADD COLUMN "gateReviseScore" INTEGER NOT NULL DEFAULT 55,
  ADD COLUMN "gateMinRecords" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "minCreativesForPattern" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "creative_ai_policies" DROP COLUMN "analysisHouseRules";

-- Which prompt judged a run, and why it was chosen.
ALTER TABLE "creative_ai_runs"
  ADD COLUMN "analysisMode" TEXT,
  ADD COLUMN "analysisModeNote" TEXT;

-- CreateTable
CREATE TABLE "creative_product_thresholds" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "targetCpp" DECIMAL(12,2) NOT NULL,
    "targetArPct" DECIMAL(5,2) NOT NULL,
    "maxCancellationPct" DECIMAL(5,2) NOT NULL,
    "maxRtsPct" DECIMAL(5,2) NOT NULL,
    "minSpendForVerdict" DECIMAL(12,2) NOT NULL,
    "minOrdersForScale" INTEGER NOT NULL DEFAULT 10,
    "minResolvedOrders" INTEGER NOT NULL DEFAULT 20,
    "deliveryWindowDays" INTEGER NOT NULL DEFAULT 10,
    "hookRateBenchmark" DECIMAL(5,4),
    "holdRateBenchmark" DECIMAL(5,4),
    "ctrBenchmark" DECIMAL(5,4),
    "scaleStepPct" INTEGER NOT NULL DEFAULT 20,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_product_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_product_thresholds_tenantId_storeConfigId_idx" ON "creative_product_thresholds"("tenantId", "storeConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "creative_product_thresholds_tenantId_storeConfigId_product_key" ON "creative_product_thresholds"("tenantId", "storeConfigId", "productName");

-- AddForeignKey
ALTER TABLE "creative_product_thresholds" ADD CONSTRAINT "creative_product_thresholds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_product_thresholds" ADD CONSTRAINT "creative_product_thresholds_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_product_thresholds" ADD CONSTRAINT "creative_product_thresholds_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
