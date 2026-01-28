-- CreateTable
CREATE TABLE "pos_product_cogs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "cogs" DECIMAL(12,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_product_cogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_product_cogs_productId_storeId_startDate_endDate_idx" ON "pos_product_cogs"("productId", "storeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "pos_product_cogs_tenantId_storeId_idx" ON "pos_product_cogs"("tenantId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_product_cogs_productId_storeId_startDate_key" ON "pos_product_cogs"("productId", "storeId", "startDate");

-- AddForeignKey
ALTER TABLE "pos_product_cogs" ADD CONSTRAINT "pos_product_cogs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_product_cogs" ADD CONSTRAINT "pos_product_cogs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "pos_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_product_cogs" ADD CONSTRAINT "pos_product_cogs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
