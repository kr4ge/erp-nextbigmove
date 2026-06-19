ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "rtsDisposedById" UUID,
ADD COLUMN "rtsDisposedAt" TIMESTAMP(3);

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_rtsDisposedById_fkey"
FOREIGN KEY ("rtsDisposedById") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "wms_fulfillment_orders_rtsDisposedById_status_idx"
ON "wms_fulfillment_orders"("rtsDisposedById", "status");
