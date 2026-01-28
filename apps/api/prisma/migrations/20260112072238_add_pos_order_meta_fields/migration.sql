-- AlterTable
ALTER TABLE "pos_orders" ADD COLUMN     "assigningCare" TEXT,
ADD COLUMN     "rtsReason" JSONB,
ADD COLUMN     "statusHistory" JSONB,
ADD COLUMN     "upsellBreakdown" JSONB;
