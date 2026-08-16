-- Units reclassified to another variant within the same store are physical WMS
-- inventory. They must not inherit one POS warehouse from the target profile,
-- otherwise orders from another POS warehouse in the same store cannot use them.
WITH latest_store_transfer AS (
  SELECT DISTINCT ON (item."inventoryUnitId")
    item."inventoryUnitId",
    item."fromStoreId",
    item."toStoreId",
    item."toVariationId"
  FROM "wms_inventory_store_transfer_items" AS item
  ORDER BY
    item."inventoryUnitId",
    item."createdAt" DESC,
    item."id" DESC
)
UPDATE "wms_inventory_units" AS unit
SET
  "posWarehouseRef" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM latest_store_transfer AS transfer
WHERE unit."id" = transfer."inventoryUnitId"
  AND transfer."fromStoreId" = transfer."toStoreId"
  AND unit."storeId" = transfer."toStoreId"
  AND unit."variationId" = transfer."toVariationId"
  AND unit."posWarehouseRef" IS NOT NULL;
