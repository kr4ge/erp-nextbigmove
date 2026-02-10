-- Add marketing source flag for sales performance confirmation rate
ALTER TABLE "pos_orders"
ADD COLUMN "isMarketingSource" BOOLEAN NOT NULL DEFAULT false;
