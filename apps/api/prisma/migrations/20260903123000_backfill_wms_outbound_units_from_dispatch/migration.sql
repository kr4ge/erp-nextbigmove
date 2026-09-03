-- Cover historical outbound units whose pick association was pruned but whose
-- immutable DISPATCH movement still links the serialized unit to its order.
WITH dispatch_units AS (
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
  COALESCE(
    (
      SELECT bu."fulfillmentLineId"
      FROM "wms_basket_units" bu
      WHERE bu."fulfillmentOrderId" = fo.id
        AND bu."inventoryUnitId" = iu.id
      ORDER BY bu."packedAt" DESC NULLS LAST
      LIMIT 1
    ),
    (
      SELECT pr."fulfillmentLineId"
      FROM "wms_pick_reservations" pr
      WHERE pr."fulfillmentOrderId" = fo.id
        AND pr."inventoryUnitId" = iu.id
      ORDER BY pr."pickedAt" DESC NULLS LAST
      LIMIT 1
    )
  ),
  CASE po.status
    WHEN 2 THEN 'SHIPPED'::"WmsOutboundUnitStatus"
    WHEN 3 THEN 'DELIVERED'::"WmsOutboundUnitStatus"
    WHEN 4 THEN 'RETURNING'::"WmsOutboundUnitStatus"
    WHEN 5 THEN 'RETURNED'::"WmsOutboundUnitStatus"
  END,
  COALESCE(ost."shippedAt", du."dispatchedAt"),
  COALESCE(ost."deliveredAt", po."deliveredAt"),
  ost."returningAt",
  COALESCE(ost."returnedAt", po."rtsAt"),
  CASE po.status
    WHEN 2 THEN COALESCE(ost."shippedAt", du."dispatchedAt", po."updatedAt")
    WHEN 3 THEN COALESCE(ost."deliveredAt", po."deliveredAt", po."updatedAt")
    WHEN 4 THEN COALESCE(ost."returningAt", po."updatedAt")
    WHEN 5 THEN COALESCE(ost."returnedAt", po."rtsAt", po."updatedAt")
  END,
  po.tracking
FROM dispatch_units du
JOIN "wms_fulfillment_orders" fo ON fo.id::text = du."fulfillmentOrderId"
JOIN "pos_orders" po ON po.id = fo."posOrderDbId" AND po.status IN (2, 3, 4, 5)
JOIN "wms_inventory_units" iu ON iu.id = du."inventoryUnitId"
LEFT JOIN order_status_times ost ON ost."posOrderDbId" = po.id
ON CONFLICT ("fulfillmentOrderId", "inventoryUnitId") DO NOTHING;
