-- Add RTS timestamp derived from status_history status=5
ALTER TABLE "pos_orders"
ADD COLUMN "rtsAt" TIMESTAMP(3);
