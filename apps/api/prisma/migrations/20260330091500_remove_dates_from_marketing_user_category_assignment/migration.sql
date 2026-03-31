-- De-duplicate to one row per tenant/team/user before adding unique constraint.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "teamCode", "userId"
      ORDER BY
        "updatedAt" DESC,
        "createdAt" DESC,
        COALESCE("endDate", DATE '9999-12-31') DESC,
        "startDate" DESC
    ) AS rn
  FROM "marketing_kpi_user_category_assignments"
)
DELETE FROM "marketing_kpi_user_category_assignments" t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Drop old range indexes (if they exist) before dropping columns.
DROP INDEX IF EXISTS "marketing_kpi_user_category_assignments_tenantId_teamCode_userId_startDate_endDate_idx";
DROP INDEX IF EXISTS "marketing_kpi_user_category_assignments_tenantId_category_teamCode_startDate_endDate_idx";

ALTER TABLE "marketing_kpi_user_category_assignments"
  DROP COLUMN "startDate",
  DROP COLUMN "endDate";

CREATE UNIQUE INDEX "marketing_kpi_user_category_assignments_tenantId_teamCode_userId_key"
ON "marketing_kpi_user_category_assignments"("tenantId", "teamCode", "userId");

CREATE INDEX "marketing_kpi_user_category_assignments_tenantId_teamCode_category_idx"
ON "marketing_kpi_user_category_assignments"("tenantId", "teamCode", "category");
