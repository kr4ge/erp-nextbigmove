-- AlterTable
ALTER TABLE "reconcile_marketing" ADD COLUMN     "confirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unconfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reconcile_sales" ADD COLUMN     "confirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unconfirmedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0;
