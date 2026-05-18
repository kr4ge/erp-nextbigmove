ALTER TABLE "wms_baskets"
ADD COLUMN IF NOT EXISTS "assignedPackerId" UUID,
ADD COLUMN IF NOT EXISTS "readyForPackAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wms_baskets_assignedPackerId_fkey'
  ) THEN
    ALTER TABLE "wms_baskets"
    ADD CONSTRAINT "wms_baskets_assignedPackerId_fkey"
    FOREIGN KEY ("assignedPackerId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "wms_baskets_assignedPackerId_status_idx"
ON "wms_baskets"("assignedPackerId", "status");
