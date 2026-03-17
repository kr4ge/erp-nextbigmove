ALTER TABLE "pos_orders"
  ADD COLUMN IF NOT EXISTS "reportsByPhoneOrderFail" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportsByPhoneOrderSuccess" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportsByPhoneWarning" INTEGER;
