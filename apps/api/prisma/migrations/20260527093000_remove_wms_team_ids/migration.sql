ALTER TABLE "wms_staff_activities"
  DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "wms_purchasing_batches"
  DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "wms_receiving_batches"
  DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "wms_inventory_units"
  DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "wms_fulfillment_orders"
  DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "wms_transfers"
  DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "wms_inventory_movements"
  DROP COLUMN IF EXISTS "teamId";
