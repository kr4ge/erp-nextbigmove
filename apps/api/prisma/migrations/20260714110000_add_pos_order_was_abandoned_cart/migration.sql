ALTER TABLE "pos_orders"
ADD COLUMN "wasAbandonedCart" BOOLEAN NOT NULL DEFAULT false;

UPDATE "pos_orders"
SET "wasAbandonedCart" = true
WHERE "isAbandoned" = true
  OR LOWER(COALESCE("orderSnapshot"->>'is_webcake_abandoned_cart', '')) IN ('true', '1', 'yes')
  OR LOWER(COALESCE("orderSnapshot"->>'isWebcakeAbandonedCart', '')) IN ('true', '1', 'yes');

CREATE INDEX "pos_orders_tenant_was_abandoned_cart_idx"
ON "pos_orders"("tenantId", "wasAbandonedCart", "dateLocal");
