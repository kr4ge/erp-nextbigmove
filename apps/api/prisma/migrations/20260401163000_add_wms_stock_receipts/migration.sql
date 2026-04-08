-- CreateEnum
CREATE TYPE "WmsStockReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELED');

-- CreateTable
CREATE TABLE "wms_stock_receipts" (
  "id" UUID NOT NULL,
  "receiptCode" TEXT NOT NULL,
  "warehouseId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "actorUserId" UUID,
  "status" "WmsStockReceiptStatus" NOT NULL DEFAULT 'POSTED',
  "supplierName" TEXT,
  "supplierReference" TEXT,
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "totalQuantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_stock_receipt_items" (
  "id" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "sku" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "variationId" TEXT,
  "variationName" TEXT,
  "barcode" TEXT,
  "quantity" DECIMAL(14,4) NOT NULL,
  "unitCost" DECIMAL(14,2) NOT NULL,
  "totalCost" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "lotCode" TEXT NOT NULL,
  "supplierBatchNo" TEXT,
  "lotId" UUID,
  "costLayerId" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wms_stock_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_stock_receipts_receiptCode_key" ON "wms_stock_receipts"("receiptCode");

-- CreateIndex
CREATE INDEX "wms_stock_receipts_warehouseId_receivedAt_idx" ON "wms_stock_receipts"("warehouseId", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_stock_receipts_locationId_receivedAt_idx" ON "wms_stock_receipts"("locationId", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_stock_receipts_status_receivedAt_idx" ON "wms_stock_receipts"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_stock_receipts_actorUserId_receivedAt_idx" ON "wms_stock_receipts"("actorUserId", "receivedAt");

-- CreateIndex
CREATE INDEX "wms_stock_receipt_items_receiptId_lineNo_idx" ON "wms_stock_receipt_items"("receiptId", "lineNo");

-- CreateIndex
CREATE INDEX "wms_stock_receipt_items_sku_idx" ON "wms_stock_receipt_items"("sku");

-- CreateIndex
CREATE INDEX "wms_stock_receipt_items_lotCode_idx" ON "wms_stock_receipt_items"("lotCode");

-- AddForeignKey
ALTER TABLE "wms_stock_receipts"
ADD CONSTRAINT "wms_stock_receipts_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipts"
ADD CONSTRAINT "wms_stock_receipts_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipts"
ADD CONSTRAINT "wms_stock_receipts_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipt_items"
ADD CONSTRAINT "wms_stock_receipt_items_receiptId_fkey"
FOREIGN KEY ("receiptId") REFERENCES "wms_stock_receipts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipt_items"
ADD CONSTRAINT "wms_stock_receipt_items_lotId_fkey"
FOREIGN KEY ("lotId") REFERENCES "wms_inventory_lots"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stock_receipt_items"
ADD CONSTRAINT "wms_stock_receipt_items_costLayerId_fkey"
FOREIGN KEY ("costLayerId") REFERENCES "wms_inventory_cost_layers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
