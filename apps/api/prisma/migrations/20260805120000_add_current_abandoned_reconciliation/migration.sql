ALTER TABLE "reconcile_marketing"
ADD COLUMN "currentAbandonedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCurrentAbandonedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentAbandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCurrentAbandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "reconcile_sales"
ADD COLUMN "currentAbandonedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCurrentAbandonedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentAbandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "repurchaseCurrentAbandonedCodPos" DECIMAL(12,2) NOT NULL DEFAULT 0;
