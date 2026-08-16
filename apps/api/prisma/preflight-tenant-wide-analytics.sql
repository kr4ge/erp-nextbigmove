-- Read-only production preflight for the tenant-wide analytics rollout.
-- This file intentionally performs no writes or schema changes.

SELECT
  COUNT(*)::int AS total_rows,
  COUNT(*) FILTER (WHERE "teamId" IS NOT NULL)::int AS rows_with_team
FROM "reconcile_marketing";

SELECT
  COUNT(*)::int AS total_rows,
  COUNT(*) FILTER (WHERE "teamId" IS NOT NULL)::int AS rows_with_team
FROM "reconcile_sales";

SELECT
  COUNT(*)::int AS total_rows,
  COUNT(*) FILTER (
    WHERE "teamCodeKey" <> '__unassigned_team_code__'
  )::int AS rows_with_team_code
FROM "reconcile_sales_attribution";

-- This must return zero before replacing the current attribution unique key
-- with (tenantId, date, campaignKey, mappingKey).
SELECT
  "tenantId",
  "date",
  "campaignKey",
  "mappingKey",
  COUNT(*)::int AS row_count
FROM "reconcile_sales_attribution"
GROUP BY
  "tenantId",
  "date",
  "campaignKey",
  "mappingKey"
HAVING COUNT(*) > 1
ORDER BY row_count DESC;
