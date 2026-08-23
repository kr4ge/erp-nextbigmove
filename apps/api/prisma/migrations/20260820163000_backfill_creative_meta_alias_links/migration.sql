-- Preserve manual links created before creatives stored Meta ad identity. Only
-- unambiguous one-to-one alias matches are backfilled.
WITH alias_tokens AS (
  SELECT
    creative."id" AS "creativeId",
    creative."tenantId",
    alias."normalizedAlias" AS "token"
  FROM "creatives" creative
  INNER JOIN "creative_aliases" alias
    ON alias."creativeId" = creative."id"
    AND alias."tenantId" = creative."tenantId"
  WHERE creative."metaAdId" IS NULL
), candidate_matches AS (
  SELECT
    token."creativeId",
    token."tenantId",
    insight."accountId",
    insight."adId",
    (ARRAY_AGG(insight."adName" ORDER BY insight."date" DESC))[1] AS "adName",
    COUNT(*) OVER (PARTITION BY token."creativeId") AS "creativeMatchCount",
    COUNT(*) OVER (
      PARTITION BY token."tenantId", insight."accountId", insight."adId"
    ) AS "adMatchCount"
  FROM alias_tokens token
  INNER JOIN "meta_ad_insights" insight
    ON insight."tenantId" = token."tenantId"
    AND (
      UPPER(TRIM(insight."adName")) = token."token"
      OR insight."adName" ~* ('(^|[^A-Za-z])' || token."token" || '([^0-9]|$)')
    )
  GROUP BY
    token."creativeId",
    token."tenantId",
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
  "metaLinkSource" = 'MANUAL'::"CreativeMetaLinkSource",
  "metaLinkedAt" = CURRENT_TIMESTAMP
FROM unambiguous_matches matched
WHERE creative."id" = matched."creativeId"
  AND creative."metaAdId" IS NULL;
