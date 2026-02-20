-- Add delivered timestamp derived from status_history status=3
ALTER TABLE "pos_orders"
ADD COLUMN "deliveredAt" TIMESTAMP(3);
