-- CreateTable
CREATE TABLE "pos_products" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" TEXT NOT NULL,
    "customId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_products_storeId_idx" ON "pos_products"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_products_storeId_productId_key" ON "pos_products"("storeId", "productId");

-- AddForeignKey
ALTER TABLE "pos_products" ADD CONSTRAINT "pos_products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
