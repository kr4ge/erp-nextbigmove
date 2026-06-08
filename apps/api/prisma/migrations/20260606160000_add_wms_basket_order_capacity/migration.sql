ALTER TABLE "wms_baskets"
ADD COLUMN "maxFulfillmentOrders" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "wms_baskets"
ADD CONSTRAINT "wms_baskets_maxFulfillmentOrders_check"
CHECK ("maxFulfillmentOrders" >= 1 AND "maxFulfillmentOrders" <= 10);
