-- DropIndex
DROP INDEX "creatives_thumbnailAssetId_idx";

-- DropIndex
DROP INDEX "pos_orders_tenant_was_abandoned_cart_idx";

-- DropIndex
DROP INDEX "wms_invoice_lines_invoiceId_lineType_idx";

-- AlterTable
ALTER TABLE "creatives" ADD COLUMN     "angle" TEXT,
ADD COLUMN     "remixOfCode" TEXT;

-- AlterTable
ALTER TABLE "undeliverable_attempt_proofs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "undeliverable_attempts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_basket_pick_demand_bins" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_basket_pick_demands" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_basket_units" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_forecast_snapshot_rows" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_forecast_snapshots" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "pastSalesWindowDays" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_invoice_lines" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_invoice_payment_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_invoice_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wms_invoices" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "creative_insight_runs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "inputSummary" JSONB,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_insight_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_insight_runs_tenantId_createdAt_idx" ON "creative_insight_runs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "creative_insight_runs" ADD CONSTRAINT "creative_insight_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "wms_forecast_snapshots_scopeKey_mode_cycleDate_forecastStartD_k" RENAME TO "wms_forecast_snapshots_scopeKey_mode_cycleDate_forecastStar_key";

-- RenameIndex
ALTER INDEX "wms_invoice_payment_profiles_invoiceSettingsId_isDefault_sortOr" RENAME TO "wms_invoice_payment_profiles_invoiceSettingsId_isDefault_so_idx";
