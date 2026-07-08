ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "priorityOverrideAt" TIMESTAMP(3),
ADD COLUMN "priorityOverrideReason" TEXT,
ADD COLUMN "priorityReleasedForOrderId" UUID;

CREATE INDEX "wms_fulfillment_orders_storeId_priorityOverrideAt_idx"
ON "wms_fulfillment_orders"("storeId", "priorityOverrideAt");

CREATE INDEX "wms_fulfillment_orders_priorityReleasedForOrderId_idx"
ON "wms_fulfillment_orders"("priorityReleasedForOrderId");
