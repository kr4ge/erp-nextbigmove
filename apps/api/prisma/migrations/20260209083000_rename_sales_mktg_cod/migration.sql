-- Rename columns to match updated naming
ALTER TABLE "pos_orders" RENAME COLUMN "upsellSales" TO "salesCod";
ALTER TABLE "pos_orders" RENAME COLUMN "mktgBaseline" TO "mktgCod";
