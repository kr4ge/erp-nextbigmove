ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "basketId" UUID;

UPDATE "wms_fulfillment_orders" AS fulfillment_order
SET "basketId" = basket."id"
FROM "wms_baskets" AS basket
WHERE basket."fulfillmentOrderId" = fulfillment_order."id"
  AND fulfillment_order."basketId" IS NULL;

CREATE INDEX "wms_fulfillment_orders_basketId_status_idx"
ON "wms_fulfillment_orders"("basketId", "status");

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_basketId_fkey"
FOREIGN KEY ("basketId") REFERENCES "wms_baskets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
