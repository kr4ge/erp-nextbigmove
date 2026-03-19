ALTER TABLE "pos_orders"
ADD COLUMN "isVoid" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "pos_orders_tenant_date_void_idx"
ON "pos_orders"("tenantId", "dateLocal", "isVoid");
