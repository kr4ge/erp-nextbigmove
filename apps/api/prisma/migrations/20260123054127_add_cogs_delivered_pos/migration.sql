-- AlterTable
ALTER TABLE "reconcile_marketing" ADD COLUMN     "cogsDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reconcile_sales" ADD COLUMN     "cogsDeliveredPos" DECIMAL(12,2) NOT NULL DEFAULT 0;
