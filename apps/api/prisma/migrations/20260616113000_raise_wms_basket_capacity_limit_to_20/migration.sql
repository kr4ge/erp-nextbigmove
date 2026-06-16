ALTER TABLE "wms_baskets"
DROP CONSTRAINT IF EXISTS "wms_baskets_maxFulfillmentOrders_check";

ALTER TABLE "wms_baskets"
ADD CONSTRAINT "wms_baskets_maxFulfillmentOrders_check"
CHECK ("maxFulfillmentOrders" >= 1 AND "maxFulfillmentOrders" <= 20);
