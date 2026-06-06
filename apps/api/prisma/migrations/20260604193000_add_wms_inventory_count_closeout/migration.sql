ALTER TYPE "WmsInventoryCountSessionStatus"
ADD VALUE IF NOT EXISTS 'CLOSED';

ALTER TABLE "wms_inventory_count_sessions"
ADD COLUMN "closedById" UUID,
ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE INDEX "wms_inventory_count_sessions_closedById_idx"
ON "wms_inventory_count_sessions"("closedById");

ALTER TABLE "wms_inventory_count_sessions"
ADD CONSTRAINT "wms_inventory_count_sessions_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
