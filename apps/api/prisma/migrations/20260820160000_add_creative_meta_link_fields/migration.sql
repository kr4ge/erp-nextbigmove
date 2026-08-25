CREATE TYPE "CreativeMetaLinkSource" AS ENUM ('AUTO_CODE', 'MANUAL');

ALTER TABLE "creatives"
  ADD COLUMN "metaAccountId" TEXT,
  ADD COLUMN "metaAdId" TEXT,
  ADD COLUMN "metaAdNameSnapshot" TEXT,
  ADD COLUMN "metaLinkSource" "CreativeMetaLinkSource",
  ADD COLUMN "metaLinkedAt" TIMESTAMP(3),
  ADD COLUMN "metaLinkedById" UUID;

ALTER TABLE "creatives"
  ADD CONSTRAINT "creatives_meta_link_fields_check"
  CHECK (
    (
      "metaAccountId" IS NULL
      AND "metaAdId" IS NULL
      AND "metaAdNameSnapshot" IS NULL
      AND "metaLinkSource" IS NULL
      AND "metaLinkedAt" IS NULL
      AND "metaLinkedById" IS NULL
    )
    OR
    (
      "metaAccountId" IS NOT NULL
      AND "metaAdId" IS NOT NULL
      AND "metaAdNameSnapshot" IS NOT NULL
      AND "metaLinkSource" IS NOT NULL
      AND "metaLinkedAt" IS NOT NULL
    )
  );

-- Backfill only one-to-one matches that are unambiguous on both sides. A
-- creative or Meta ad with multiple possible matches remains unlinked for
-- explicit review rather than being assigned arbitrarily.
WITH candidate_matches AS (
  SELECT
    creative."id" AS "creativeId",
    insight."accountId",
    insight."adId",
    (ARRAY_AGG(insight."adName" ORDER BY insight."date" DESC))[1] AS "adName",
    COUNT(*) OVER (PARTITION BY creative."id") AS "creativeMatchCount",
    COUNT(*) OVER (
      PARTITION BY creative."tenantId", insight."accountId", insight."adId"
    ) AS "adMatchCount"
  FROM "creatives" creative
  INNER JOIN "meta_ad_insights" insight
    ON insight."tenantId" = creative."tenantId"
    AND insight."adName" ~* (
      '(^|[^A-Za-z])' || creative."code" || '([^0-9]|$)'
    )
  GROUP BY
    creative."id",
    creative."tenantId",
    insight."accountId",
    insight."adId"
), unambiguous_matches AS (
  SELECT *
  FROM candidate_matches
  WHERE "creativeMatchCount" = 1 AND "adMatchCount" = 1
)
UPDATE "creatives" creative
SET
  "metaAccountId" = matched."accountId",
  "metaAdId" = matched."adId",
  "metaAdNameSnapshot" = matched."adName",
  "metaLinkSource" = 'AUTO_CODE'::"CreativeMetaLinkSource",
  "metaLinkedAt" = CURRENT_TIMESTAMP
FROM unambiguous_matches matched
WHERE creative."id" = matched."creativeId";

CREATE UNIQUE INDEX "creatives_tenantId_metaAccountId_metaAdId_key"
  ON "creatives"("tenantId", "metaAccountId", "metaAdId");

CREATE INDEX "creatives_tenantId_metaAdId_idx"
  ON "creatives"("tenantId", "metaAdId");

ALTER TABLE "creatives"
  ADD CONSTRAINT "creatives_metaLinkedById_fkey"
  FOREIGN KEY ("metaLinkedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
