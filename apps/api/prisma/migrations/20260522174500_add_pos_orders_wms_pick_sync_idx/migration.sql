CREATE INDEX IF NOT EXISTS "pos_orders_wms_pick_sync_idx"
ON "pos_orders"("tenantId", "shopId", "status", "isVoid", "insertedAt");
