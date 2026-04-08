-- CreateEnum
CREATE TYPE "WmsSkuStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "wms_skus" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "unit" TEXT,
  "barcode" TEXT,
  "status" "WmsSkuStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wms_sku_pos_product_mappings" (
  "id" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "posProductId" UUID NOT NULL,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_sku_pos_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_skus_code_key" ON "wms_skus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wms_skus_barcode_key" ON "wms_skus"("barcode");

-- CreateIndex
CREATE INDEX "wms_skus_status_idx" ON "wms_skus"("status");

-- CreateIndex
CREATE INDEX "wms_skus_name_idx" ON "wms_skus"("name");

-- CreateIndex
CREATE INDEX "wms_skus_category_idx" ON "wms_skus"("category");

-- CreateIndex
CREATE UNIQUE INDEX "wms_sku_pos_product_mappings_posProductId_key" ON "wms_sku_pos_product_mappings"("posProductId");

-- CreateIndex
CREATE INDEX "wms_sku_pos_product_mappings_skuId_idx" ON "wms_sku_pos_product_mappings"("skuId");

-- AddForeignKey
ALTER TABLE "wms_sku_pos_product_mappings"
ADD CONSTRAINT "wms_sku_pos_product_mappings_skuId_fkey"
FOREIGN KEY ("skuId") REFERENCES "wms_skus"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_sku_pos_product_mappings"
ADD CONSTRAINT "wms_sku_pos_product_mappings_posProductId_fkey"
FOREIGN KEY ("posProductId") REFERENCES "pos_products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
