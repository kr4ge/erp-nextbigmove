ALTER TYPE "WmsInventoryUnitStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "wms_product_profiles"
ADD COLUMN "requiresExpirationDate" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "wms_inventory_units"
ADD COLUMN "expirationDate" DATE,
ADD COLUMN "expiredAt" TIMESTAMP(3);

CREATE INDEX "wms_inventory_units_tenantId_status_expirationDate_idx"
ON "wms_inventory_units"("tenantId", "status", "expirationDate");
