-- Second half of the QC removal. Split from the previous migration because
-- Postgres cannot use a newly added enum value in the same transaction that
-- adds it ('REVISION' was added to CreativeStatusDimension there).

-- Relabel QC history so the audit trail survives rather than being deleted.
UPDATE "creative_status_events" SET "dimension" = 'REVISION' WHERE "dimension" = 'QC';

-- Rebuild the dimension enum without QC now that no row references it.
ALTER TYPE "CreativeStatusDimension" RENAME TO "CreativeStatusDimension_old";
CREATE TYPE "CreativeStatusDimension" AS ENUM ('PERFORMANCE', 'REVISION');
ALTER TABLE "creative_status_events"
  ALTER COLUMN "dimension" TYPE "CreativeStatusDimension"
  USING ("dimension"::text::"CreativeStatusDimension");
DROP TYPE "CreativeStatusDimension_old";

-- Retire the QC column and its index.
DROP INDEX IF EXISTS "creatives_tenantId_qcStatus_idx";
ALTER TABLE "creatives" DROP COLUMN IF EXISTS "qcStatus";
CREATE INDEX IF NOT EXISTS "creatives_tenantId_revisionState_idx" ON "creatives"("tenantId", "revisionState");
DROP TYPE IF EXISTS "CreativeQcStatus";
