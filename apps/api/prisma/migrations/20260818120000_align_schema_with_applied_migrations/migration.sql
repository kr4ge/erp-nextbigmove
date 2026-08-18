-- Alisin ang drift sa pagitan ng schema.prisma at ng aktwal na estado ng
-- database. Ang mga default na ito ay naidagdag ng mga hand-written na
-- migration; hindi sila kailanman gumagana dahil laging nagpapadala si
-- Prisma ng halaga para sa id, updatedAt, at pastSalesWindowDays.
-- Walang raw INSERT sa codebase na umaasa sa kanila.
--
-- Ang dalawang index na dating lumalabas dito bilang DROP ay ipinahayag na
-- sa schema.prisma sa halip — totoo silang ginagamit at hindi dapat mawala.

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

-- RenameIndex
ALTER INDEX "wms_forecast_snapshots_scopeKey_mode_cycleDate_forecastStartD_k" RENAME TO "wms_forecast_snapshots_scopeKey_mode_cycleDate_forecastStar_key";

-- RenameIndex
ALTER INDEX "wms_invoice_payment_profiles_invoiceSettingsId_isDefault_sortOr" RENAME TO "wms_invoice_payment_profiles_invoiceSettingsId_isDefault_so_idx";

