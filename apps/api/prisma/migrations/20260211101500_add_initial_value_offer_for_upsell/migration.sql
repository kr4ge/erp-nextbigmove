-- Add initial value offer to pos_stores
ALTER TABLE "pos_stores" ADD COLUMN "initialValueOffer" DECIMAL(12,2);

-- Add forUpsell flag to pos_orders
ALTER TABLE "pos_orders" ADD COLUMN "forUpsell" BOOLEAN NOT NULL DEFAULT false;
