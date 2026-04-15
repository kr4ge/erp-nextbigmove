ALTER TYPE "WmsFulfillmentOrderStatus"
ADD VALUE 'DISPATCHED';

ALTER TYPE "WmsFulfillmentScanStage"
ADD VALUE 'DISPATCH';

ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "dispatchedAt" TIMESTAMP(3);
