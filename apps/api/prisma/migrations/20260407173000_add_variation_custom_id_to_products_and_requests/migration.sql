ALTER TABLE "pos_products"
ADD COLUMN "variationCustomId" TEXT;

UPDATE "pos_products"
SET "variationCustomId" = COALESCE(
  "productSnapshot"->>'display_id',
  "productSnapshot"->>'product_display_id',
  "productSnapshot"->'product'->>'display_id',
  "customId"
)
WHERE "variationCustomId" IS NULL;

CREATE INDEX "pos_products_storeId_variationCustomId_idx"
ON "pos_products"("storeId", "variationCustomId");

ALTER TABLE "wms_stock_request_lines"
ADD COLUMN "variationCustomId" TEXT;

UPDATE "wms_stock_request_lines" AS lines
SET "variationCustomId" = products."variationCustomId"
FROM "pos_products" AS products
WHERE products."id" = lines."posProductId"
  AND lines."variationCustomId" IS NULL;

CREATE INDEX "wms_stock_request_lines_variationCustomId_idx"
ON "wms_stock_request_lines"("variationCustomId");

ALTER TABLE "wms_stock_request_invoice_lines"
ADD COLUMN "variationCustomId" TEXT;

UPDATE "wms_stock_request_invoice_lines" AS lines
SET "variationCustomId" = requests."variationCustomId"
FROM "wms_stock_request_lines" AS requests
WHERE requests."id" = lines."requestLineId"
  AND lines."variationCustomId" IS NULL;
