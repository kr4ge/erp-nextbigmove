ALTER TABLE "pos_products"
ADD COLUMN "variationId" TEXT,
ADD COLUMN "productSnapshot" JSONB;

UPDATE "pos_products"
SET "variationId" = "productId"
WHERE "variationId" IS NULL;

CREATE INDEX IF NOT EXISTS "pos_products_storeId_variationId_idx"
ON "pos_products"("storeId", "variationId");
