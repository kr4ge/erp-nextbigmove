-- Automatic matching is intentionally strict: the entire Meta ad name must
-- equal the registry creative code. Manual accountId + adId links are kept.
UPDATE "creatives" creative
SET
  "metaAccountId" = NULL,
  "metaAdId" = NULL,
  "metaAdNameSnapshot" = NULL,
  "metaLinkSource" = NULL,
  "metaLinkedAt" = NULL,
  "metaLinkedById" = NULL
WHERE creative."metaLinkSource" = 'AUTO_CODE'::"CreativeMetaLinkSource"
  AND NOT EXISTS (
    SELECT 1
    FROM "meta_ad_insights" insight
    WHERE insight."tenantId" = creative."tenantId"
      AND insight."accountId" = creative."metaAccountId"
      AND insight."adId" = creative."metaAdId"
      AND insight."adName" = creative."code"
  );

WITH candidate_matches AS (
  SELECT
    creative."id" AS "creativeId",
    creative."tenantId",
    insight."accountId",
    insight."adId",
    insight."adName",
    COUNT(*) OVER (PARTITION BY creative."id") AS "creativeMatchCount",
    COUNT(*) OVER (
      PARTITION BY creative."tenantId", insight."accountId", insight."adId"
    ) AS "adMatchCount"
  FROM "creatives" creative
  INNER JOIN (
    SELECT DISTINCT "tenantId", "accountId", "adId", "adName"
    FROM "meta_ad_insights"
  ) insight
    ON insight."tenantId" = creative."tenantId"
    AND insight."adName" = creative."code"
  WHERE creative."metaAdId" IS NULL
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
WHERE creative."id" = matched."creativeId"
  AND creative."metaAdId" IS NULL;
