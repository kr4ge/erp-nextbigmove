-- Support server-side Stock Records filtering by latest inventory activity.
-- Prisma runs PostgreSQL migrations in a transaction, so these indexes must
-- use transaction-compatible CREATE INDEX statements.
CREATE INDEX IF NOT EXISTS "wms_inventory_units_updatedAt_idx"
  ON "wms_inventory_units"("updatedAt");

CREATE INDEX IF NOT EXISTS "wms_inventory_units_tenantId_updatedAt_idx"
  ON "wms_inventory_units"("tenantId", "updatedAt");

CREATE INDEX IF NOT EXISTS "wms_inventory_units_tenantId_storeId_updatedAt_idx"
  ON "wms_inventory_units"("tenantId", "storeId", "updatedAt");
