CREATE TABLE "wms_inventory_store_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "fromStoreId" UUID NOT NULL,
  "toStoreId" UUID NOT NULL,
  "targetProfileId" UUID NOT NULL,
  "notes" TEXT,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_inventory_store_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_inventory_store_transfer_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transferId" UUID NOT NULL,
  "inventoryUnitId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "fromStoreId" UUID NOT NULL,
  "toStoreId" UUID NOT NULL,
  "fromPosProductId" UUID NOT NULL,
  "toPosProductId" UUID NOT NULL,
  "fromProductProfileId" UUID NOT NULL,
  "toProductProfileId" UUID NOT NULL,
  "fromProductId" TEXT NOT NULL,
  "toProductId" TEXT NOT NULL,
  "fromVariationId" TEXT NOT NULL,
  "toVariationId" TEXT NOT NULL,
  "unitCost" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_inventory_store_transfer_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_inventory_store_transfers_code_key" ON "wms_inventory_store_transfers"("code");
CREATE INDEX "wms_inventory_store_transfers_tenantId_createdAt_idx" ON "wms_inventory_store_transfers"("tenantId", "createdAt");
CREATE INDEX "wms_inventory_store_transfers_tenantId_fromStoreId_toStoreId_idx" ON "wms_inventory_store_transfers"("tenantId", "fromStoreId", "toStoreId");
CREATE INDEX "wms_inventory_store_transfers_targetProfileId_idx" ON "wms_inventory_store_transfers"("targetProfileId");

CREATE UNIQUE INDEX "wms_inventory_store_transfer_items_transferId_lineNo_key" ON "wms_inventory_store_transfer_items"("transferId", "lineNo");
CREATE UNIQUE INDEX "wms_inventory_store_transfer_items_transferId_inventoryUnitId_key" ON "wms_inventory_store_transfer_items"("transferId", "inventoryUnitId");
CREATE INDEX "wms_inventory_store_transfer_items_inventoryUnitId_idx" ON "wms_inventory_store_transfer_items"("inventoryUnitId");
CREATE INDEX "wms_inventory_store_transfer_items_fromStoreId_toStoreId_idx" ON "wms_inventory_store_transfer_items"("fromStoreId", "toStoreId");
CREATE INDEX "wms_inventory_store_transfer_items_fromVariationId_toVariationId_idx" ON "wms_inventory_store_transfer_items"("fromVariationId", "toVariationId");

ALTER TABLE "wms_inventory_store_transfer_items"
  ADD CONSTRAINT "wms_inventory_store_transfer_items_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "wms_inventory_store_transfers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_store_transfer_items"
  ADD CONSTRAINT "wms_inventory_store_transfer_items_inventoryUnitId_fkey"
  FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
