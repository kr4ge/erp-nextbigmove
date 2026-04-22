CREATE TYPE "WmsReceivingBatchStatus" AS ENUM (
  'DRAFT',
  'ARRIVED',
  'COUNTED',
  'STAGED',
  'PUTAWAY_PENDING',
  'COMPLETED',
  'CANCELED'
);

CREATE TABLE "wms_receiving_batches" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "teamId" UUID,
  "storeId" UUID NOT NULL,
  "purchasingBatchId" UUID,
  "warehouseId" UUID NOT NULL,
  "stagingLocationId" UUID,
  "status" "WmsReceivingBatchStatus" NOT NULL DEFAULT 'STAGED',
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_receiving_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_receiving_lines" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "purchasingBatchLineId" UUID,
  "resolvedPosProductId" UUID,
  "resolvedProfileId" UUID,
  "productId" TEXT,
  "variationId" TEXT,
  "requestedProductName" TEXT,
  "expectedQuantity" INTEGER NOT NULL,
  "receivedQuantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(14, 2),
  "notes" TEXT,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_receiving_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "wms_inventory_units"
ADD COLUMN "receivingBatchId" UUID;

CREATE UNIQUE INDEX "wms_receiving_batches_code_key"
ON "wms_receiving_batches"("code");

CREATE INDEX "wms_receiving_batches_tenantId_storeId_status_idx"
ON "wms_receiving_batches"("tenantId", "storeId", "status");

CREATE INDEX "wms_receiving_batches_tenantId_purchasingBatchId_idx"
ON "wms_receiving_batches"("tenantId", "purchasingBatchId");

CREATE INDEX "wms_receiving_batches_warehouseId_stagingLocationId_idx"
ON "wms_receiving_batches"("warehouseId", "stagingLocationId");

CREATE UNIQUE INDEX "wms_receiving_lines_batchId_lineNo_key"
ON "wms_receiving_lines"("batchId", "lineNo");

CREATE INDEX "wms_receiving_lines_tenantId_storeId_idx"
ON "wms_receiving_lines"("tenantId", "storeId");

CREATE INDEX "wms_receiving_lines_purchasingBatchLineId_idx"
ON "wms_receiving_lines"("purchasingBatchLineId");

CREATE INDEX "wms_receiving_lines_resolvedPosProductId_idx"
ON "wms_receiving_lines"("resolvedPosProductId");

CREATE INDEX "wms_receiving_lines_resolvedProfileId_idx"
ON "wms_receiving_lines"("resolvedProfileId");

CREATE INDEX "wms_inventory_units_receivingBatchId_idx"
ON "wms_inventory_units"("receivingBatchId");

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_purchasingBatchId_fkey"
FOREIGN KEY ("purchasingBatchId") REFERENCES "wms_purchasing_batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_stagingLocationId_fkey"
FOREIGN KEY ("stagingLocationId") REFERENCES "wms_locations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_batches"
ADD CONSTRAINT "wms_receiving_batches_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "wms_receiving_batches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_purchasingBatchLineId_fkey"
FOREIGN KEY ("purchasingBatchLineId") REFERENCES "wms_purchasing_batch_lines"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_resolvedPosProductId_fkey"
FOREIGN KEY ("resolvedPosProductId") REFERENCES "pos_products"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_resolvedProfileId_fkey"
FOREIGN KEY ("resolvedProfileId") REFERENCES "wms_product_profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_receiving_lines"
ADD CONSTRAINT "wms_receiving_lines_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_units"
ADD CONSTRAINT "wms_inventory_units_receivingBatchId_fkey"
FOREIGN KEY ("receivingBatchId") REFERENCES "wms_receiving_batches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
