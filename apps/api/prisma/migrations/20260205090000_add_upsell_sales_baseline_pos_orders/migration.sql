-- Add upsell sales and marketing baseline fields to pos_orders
ALTER TABLE "pos_orders"
  ADD COLUMN "upsellSales" DECIMAL(12, 2),
  ADD COLUMN "mktgBaseline" DECIMAL(12, 2);
