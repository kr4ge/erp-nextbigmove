-- Remove the QC approval gate. A creative linked to a running Meta ad is
-- already live, so approval was gating work that had shipped. Advertising now
-- communicates through comment threads plus a request-for-changes flag.

-- 1. New revision state.
CREATE TYPE "CreativeRevisionState" AS ENUM ('NONE', 'NEEDS_REVISION', 'RESOLVED');

ALTER TABLE "creatives"
  ADD COLUMN IF NOT EXISTS "revisionState" "CreativeRevisionState" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "revisionRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revisionResolvedAt" TIMESTAMP(3);

-- 2. Carry forward the only QC state that still means something: a creative
--    that was mid-revision keeps an open request so nothing in flight is lost.
UPDATE "creatives"
   SET "revisionState" = 'NEEDS_REVISION',
       "revisionRequestedAt" = COALESCE("updatedAt", NOW())
 WHERE "qcStatus" IN ('FOR_REVISION', 'REVISED');

-- 3. Retire QC history rather than deleting it: existing QC events are
--    relabelled REVISION so the audit trail survives the enum change.
ALTER TYPE "CreativeStatusDimension" ADD VALUE IF NOT EXISTS 'REVISION';
