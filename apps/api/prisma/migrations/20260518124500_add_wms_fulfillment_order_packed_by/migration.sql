ALTER TABLE "wms_fulfillment_orders"
ADD COLUMN "packedById" UUID;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_packedById_fkey"
FOREIGN KEY ("packedById") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "wms_fulfillment_orders_packedById_status_idx"
ON "wms_fulfillment_orders"("packedById", "status");
