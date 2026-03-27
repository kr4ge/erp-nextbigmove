ALTER TABLE "pos_products"
ADD COLUMN "warehouseId" TEXT;

CREATE INDEX "pos_products_storeId_warehouseId_idx"
ON "pos_products"("storeId", "warehouseId");
