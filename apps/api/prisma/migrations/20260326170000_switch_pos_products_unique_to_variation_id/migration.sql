DROP INDEX IF EXISTS "pos_products_storeId_productId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "pos_products_storeId_variationId_key"
ON "pos_products"("storeId", "variationId");
