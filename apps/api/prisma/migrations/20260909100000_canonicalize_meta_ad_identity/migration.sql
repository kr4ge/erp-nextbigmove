-- Preserve every source row that is superseded while collapsing historical
-- `manual:` and provider account identities into one active Meta ad-day.
CREATE TABLE "meta_ad_insight_duplicate_archives" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "originalInsightId" UUID NOT NULL,
  "canonicalInsightId" UUID NOT NULL,
  "accountId" TEXT NOT NULL,
  "adId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meta_ad_insight_duplicate_archives_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_ad_insight_duplicate_archives_originalInsightId_key"
ON "meta_ad_insight_duplicate_archives"("originalInsightId");

CREATE INDEX "meta_ad_insight_duplicate_archives_tenantId_adId_date_idx"
ON "meta_ad_insight_duplicate_archives"("tenantId", "adId", "date");

ALTER TABLE "meta_ad_insight_duplicate_archives"
ADD CONSTRAINT "meta_ad_insight_duplicate_archives_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH ranked AS (
  SELECT
    insight."id",
    FIRST_VALUE(insight."id") OVER (
      PARTITION BY insight."tenantId", insight."adId", insight."date"
      ORDER BY
        CASE WHEN LOWER(insight."accountId") LIKE 'manual:%' THEN 1 ELSE 0 END,
        insight."updatedAt" DESC,
        insight."createdAt" DESC,
        insight."id"
    ) AS "canonicalInsightId",
    ROW_NUMBER() OVER (
      PARTITION BY insight."tenantId", insight."adId", insight."date"
      ORDER BY
        CASE WHEN LOWER(insight."accountId") LIKE 'manual:%' THEN 1 ELSE 0 END,
        insight."updatedAt" DESC,
        insight."createdAt" DESC,
        insight."id"
    ) AS rank
  FROM "meta_ad_insights" insight
)
INSERT INTO "meta_ad_insight_duplicate_archives" (
  "id",
  "tenantId",
  "originalInsightId",
  "canonicalInsightId",
  "accountId",
  "adId",
  "date",
  "reason",
  "payload",
  "archivedAt"
)
SELECT
  gen_random_uuid(),
  duplicate."tenantId",
  duplicate."id",
  ranked."canonicalInsightId",
  duplicate."accountId",
  duplicate."adId",
  duplicate."date",
  'SUPERSEDED_ACCOUNT_IDENTITY',
  TO_JSONB(duplicate),
  CURRENT_TIMESTAMP
FROM ranked
INNER JOIN "meta_ad_insights" duplicate ON duplicate."id" = ranked."id"
WHERE ranked.rank > 1;

DELETE FROM "meta_ad_insights" active
USING "meta_ad_insight_duplicate_archives" archived
WHERE active."id" = archived."originalInsightId";

-- Reconciliation is already unique by tenant + ad + day. Align its Meta-side
-- identity and raw metrics with the canonical insight without touching its POS
-- order aggregates or manually resolved product mapping.
UPDATE "reconcile_marketing" reconciled
SET
  "teamId" = canonical."teamId",
  "accountId" = canonical."accountId",
  "campaignId" = canonical."campaignId",
  "campaignName" = canonical."campaignName",
  "adsetId" = canonical."adsetId",
  "adName" = canonical."adName",
  "marketingAssociate" = canonical."marketingAssociate",
  "teamCode" = canonical."teamCode",
  "spend" = canonical."spend",
  "clicks" = canonical."clicks",
  "linkClicks" = canonical."linkClicks",
  "impressions" = canonical."impressions",
  "leads" = canonical."leads",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "meta_ad_insights" canonical
WHERE reconciled."tenantId" = canonical."tenantId"
  AND reconciled."adId" = canonical."adId"
  AND reconciled."date" = canonical."date"
  AND EXISTS (
    SELECT 1
    FROM "meta_ad_insight_duplicate_archives" archived
    WHERE archived."canonicalInsightId" = canonical."id"
  );

-- Retain the previous source-specific unique index for rolling-deploy
-- compatibility, then add the stricter business identity used by new code.
CREATE UNIQUE INDEX "meta_ad_insights_tenantId_adId_date_key"
ON "meta_ad_insights"("tenantId", "adId", "date");

-- One Meta Ad ID can belong to only one enrolled creative in a tenant. Abort
-- instead of guessing if pre-existing data assigns it to multiple creatives.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "creative_meta_ad_links"
    GROUP BY "tenantId", "adId"
    HAVING COUNT(DISTINCT "creativeId") > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize Meta ad links: an Ad ID is linked to multiple creatives in one tenant';
  END IF;
END $$;

-- Multiple account identities linked to the same creative are harmless. Keep
-- the numeric/provider account link and record removal of any legacy duplicate.
WITH ranked_links AS (
  SELECT
    link."id",
    link."tenantId",
    link."creativeId",
    link."accountId",
    link."adId",
    ROW_NUMBER() OVER (
      PARTITION BY link."tenantId", link."adId"
      ORDER BY
        CASE WHEN LOWER(link."accountId") LIKE 'manual:%' THEN 1 ELSE 0 END,
        link."linkedAt",
        link."id"
    ) AS rank
  FROM "creative_meta_ad_links" link
)
INSERT INTO "audit_logs" (
  "id",
  "tenantId",
  "userId",
  "action",
  "resource",
  "resourceId",
  "changes",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  duplicate."tenantId",
  NULL,
  'creative.metaLink.deduplicate',
  'Creative',
  duplicate."creativeId",
  JSONB_BUILD_OBJECT(
    'accountId', duplicate."accountId",
    'adId', duplicate."adId",
    'reason', 'SUPERSEDED_ACCOUNT_IDENTITY'
  ),
  CURRENT_TIMESTAMP
FROM ranked_links duplicate
WHERE duplicate.rank > 1;

WITH ranked_links AS (
  SELECT
    link."id",
    ROW_NUMBER() OVER (
      PARTITION BY link."tenantId", link."adId"
      ORDER BY
        CASE WHEN LOWER(link."accountId") LIKE 'manual:%' THEN 1 ELSE 0 END,
        link."linkedAt",
        link."id"
    ) AS rank
  FROM "creative_meta_ad_links" link
)
DELETE FROM "creative_meta_ad_links" link
USING ranked_links duplicate
WHERE link."id" = duplicate."id"
  AND duplicate.rank > 1;

-- Keep the denormalized primary link on creatives aligned with the surviving
-- canonical relation. This also upgrades an old `manual:` primary account to
-- the provider account without changing creative ownership.
UPDATE "creatives" creative
SET
  "metaAccountId" = link."accountId",
  "metaAdNameSnapshot" = link."adNameSnapshot",
  "metaLinkSource" = link."source",
  "metaLinkedAt" = link."linkedAt",
  "metaLinkedById" = link."linkedById",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "creative_meta_ad_links" link
WHERE creative."tenantId" = link."tenantId"
  AND creative."id" = link."creativeId"
  AND creative."metaAdId" = link."adId"
  AND creative."metaAccountId" IS DISTINCT FROM link."accountId";

CREATE UNIQUE INDEX "creative_meta_ad_links_tenantId_adId_key"
ON "creative_meta_ad_links"("tenantId", "adId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "creatives"
    WHERE "metaAdId" IS NOT NULL
    GROUP BY "tenantId", "metaAdId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize creative primary links: an Ad ID is assigned to multiple creatives in one tenant';
  END IF;
END $$;

CREATE UNIQUE INDEX "creatives_tenantId_metaAdId_key"
ON "creatives"("tenantId", "metaAdId");
