ALTER TABLE "pos_orders"
ADD COLUMN "undeliverableAt" TIMESTAMP(3),
ADD COLUMN "isUndeliverable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "pos_orders_tenant_undeliverable_at_shop_idx"
ON "pos_orders"("tenantId", "isUndeliverable", "undeliverableAt", "shopId");
