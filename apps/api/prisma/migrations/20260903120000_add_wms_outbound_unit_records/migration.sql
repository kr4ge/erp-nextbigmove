-- Durable, item-level outbound lifecycle projection for WMS inventory reporting.
CREATE TYPE "WmsOutboundUnitStatus" AS ENUM (
  'SHIPPED',
  'DELIVERED',
  'RETURNING',
  'RETURNED'
);

CREATE TABLE "wms_outbound_unit_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "productProfileId" UUID NOT NULL,
  "inventoryUnitId" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "fulfillmentLineId" UUID,
  "currentStatus" "WmsOutboundUnitStatus" NOT NULL,
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "returningAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "latestEventAt" TIMESTAMP(3) NOT NULL,
  "trackingCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_outbound_unit_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_outbound_unit_records_fulfillmentOrderId_inventoryUnitId_key"
  ON "wms_outbound_unit_records"("fulfillmentOrderId", "inventoryUnitId");
CREATE INDEX "wms_outbound_unit_records_tenantId_currentStatus_latestEventAt_idx"
  ON "wms_outbound_unit_records"("tenantId", "currentStatus", "latestEventAt");
CREATE INDEX "wms_outbound_unit_records_tenantId_storeId_currentStatus_latestEventAt_idx"
  ON "wms_outbound_unit_records"("tenantId", "storeId", "currentStatus", "latestEventAt");
CREATE INDEX "wms_outbound_unit_records_tenantId_productProfileId_currentStatus_latestEventAt_idx"
  ON "wms_outbound_unit_records"("tenantId", "productProfileId", "currentStatus", "latestEventAt");
CREATE INDEX "wms_outbound_unit_records_inventoryUnitId_latestEventAt_idx"
  ON "wms_outbound_unit_records"("inventoryUnitId", "latestEventAt");

ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_productProfileId_fkey"
  FOREIGN KEY ("productProfileId") REFERENCES "wms_product_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_inventoryUnitId_fkey"
  FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_fulfillmentOrderId_fkey"
  FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wms_outbound_unit_records"
  ADD CONSTRAINT "wms_outbound_unit_records_fulfillmentLineId_fkey"
  FOREIGN KEY ("fulfillmentLineId") REFERENCES "wms_fulfillment_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill current outbound units from both fulfillment assignment modes. Status-history
-- timestamps are preferred; dispatch movements and first-class POS timestamps are fallbacks.
WITH unit_links AS (
  SELECT DISTINCT
    bu."fulfillmentOrderId",
    bu."inventoryUnitId",
    bu."fulfillmentLineId"
  FROM "wms_basket_units" bu
  WHERE bu."fulfillmentOrderId" IS NOT NULL
    AND bu."packedAt" IS NOT NULL

  UNION

  SELECT DISTINCT
    pr."fulfillmentOrderId",
    pr."inventoryUnitId",
    pr."fulfillmentLineId"
  FROM "wms_pick_reservations" pr
  WHERE pr."pickedAt" IS NOT NULL

),
dispatch_times AS (
  SELECT
    m."referenceId" AS "fulfillmentOrderId",
    m."inventoryUnitId",
    MIN(m."createdAt") AS "dispatchedAt"
  FROM "wms_inventory_movements" m
  WHERE m."movementType" = 'DISPATCH'
    AND m."referenceType" = 'WMS_FULFILLMENT_ORDER'
    AND m."referenceId" IS NOT NULL
  GROUP BY m."referenceId", m."inventoryUnitId"
),
order_status_times AS (
  SELECT
    po.id AS "posOrderDbId",
    MAX(
      CASE
        WHEN entry->>'status' = '2'
          AND entry->>'updated_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]'
        THEN (entry->>'updated_at')::timestamptz
      END
    ) AS "shippedAt",
    MAX(
      CASE
        WHEN entry->>'status' = '3'
          AND entry->>'updated_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]'
        THEN (entry->>'updated_at')::timestamptz
      END
    ) AS "deliveredAt",
    MAX(
      CASE
        WHEN entry->>'status' = '4'
          AND entry->>'updated_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]'
        THEN (entry->>'updated_at')::timestamptz
      END
    ) AS "returningAt",
    MAX(
      CASE
        WHEN entry->>'status' = '5'
          AND entry->>'updated_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ]'
        THEN (entry->>'updated_at')::timestamptz
      END
    ) AS "returnedAt"
  FROM "pos_orders" po
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(po."statusHistory") = 'array' THEN po."statusHistory"
      ELSE '[]'::jsonb
    END
  ) entry ON TRUE
  WHERE po.status IN (2, 3, 4, 5)
  GROUP BY po.id
)
INSERT INTO "wms_outbound_unit_records" (
  "tenantId",
  "storeId",
  "warehouseId",
  "productProfileId",
  "inventoryUnitId",
  "fulfillmentOrderId",
  "fulfillmentLineId",
  "currentStatus",
  "shippedAt",
  "deliveredAt",
  "returningAt",
  "returnedAt",
  "latestEventAt",
  "trackingCode"
)
SELECT
  fo."tenantId",
  fo."storeId",
  iu."warehouseId",
  iu."productProfileId",
  iu.id,
  fo.id,
  ul."fulfillmentLineId",
  CASE po.status
    WHEN 2 THEN 'SHIPPED'::"WmsOutboundUnitStatus"
    WHEN 3 THEN 'DELIVERED'::"WmsOutboundUnitStatus"
    WHEN 4 THEN 'RETURNING'::"WmsOutboundUnitStatus"
    WHEN 5 THEN 'RETURNED'::"WmsOutboundUnitStatus"
  END,
  COALESCE(ost."shippedAt", dt."dispatchedAt"),
  COALESCE(ost."deliveredAt", po."deliveredAt"),
  ost."returningAt",
  COALESCE(ost."returnedAt", po."rtsAt"),
  CASE po.status
    WHEN 2 THEN COALESCE(ost."shippedAt", dt."dispatchedAt", po."updatedAt")
    WHEN 3 THEN COALESCE(ost."deliveredAt", po."deliveredAt", po."updatedAt")
    WHEN 4 THEN COALESCE(ost."returningAt", po."updatedAt")
    WHEN 5 THEN COALESCE(ost."returnedAt", po."rtsAt", po."updatedAt")
  END,
  po.tracking
FROM unit_links ul
JOIN "wms_fulfillment_orders" fo ON fo.id = ul."fulfillmentOrderId"
JOIN "pos_orders" po ON po.id = fo."posOrderDbId" AND po.status IN (2, 3, 4, 5)
JOIN "wms_inventory_units" iu ON iu.id = ul."inventoryUnitId"
LEFT JOIN dispatch_times dt
  ON dt."fulfillmentOrderId" = fo.id::text
  AND dt."inventoryUnitId" = iu.id
LEFT JOIN order_status_times ost ON ost."posOrderDbId" = po.id
ON CONFLICT ("fulfillmentOrderId", "inventoryUnitId") DO NOTHING;
