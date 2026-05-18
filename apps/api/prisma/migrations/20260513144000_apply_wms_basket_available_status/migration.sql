ALTER TABLE "wms_baskets"
ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';

UPDATE "wms_baskets"
SET "status" = 'AVAILABLE'
WHERE "status" = 'EMPTY';

CREATE UNIQUE INDEX IF NOT EXISTS "wms_pick_reservations_active_unit_key"
ON "wms_pick_reservations"("inventoryUnitId")
WHERE "status" IN ('RESERVED', 'PICKED');
