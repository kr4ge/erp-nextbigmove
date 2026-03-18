-- Mark confirmation status updates as in-flight to hide rows immediately
-- and prevent duplicate update requests while waiting for webhook callback.
ALTER TABLE "pos_orders"
  ADD COLUMN "confirmationUpdateRequestedAt" TIMESTAMP(3),
  ADD COLUMN "confirmationUpdateTargetStatus" INTEGER;

CREATE INDEX "pos_orders_confirmation_queue_idx"
  ON "pos_orders"("tenantId", "status", "dateLocal", "confirmationUpdateRequestedAt");
