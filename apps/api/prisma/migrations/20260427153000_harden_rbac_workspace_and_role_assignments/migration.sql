-- Add explicit RBAC workspace so role ownership is persisted instead of inferred.
CREATE TYPE "RbacWorkspace" AS ENUM ('ERP', 'WMS');

ALTER TABLE "roles"
ADD COLUMN "workspace" "RbacWorkspace" NOT NULL DEFAULT 'ERP';

ALTER TABLE "user_roles"
ADD COLUMN "workspace" "RbacWorkspace";

-- Backfill role workspace from existing WMS naming/permission patterns.
UPDATE "roles"
SET "workspace" = 'WMS'
WHERE "key" LIKE 'WMS\_%';

WITH wms_roles AS (
  SELECT r.id
  FROM "roles" r
  JOIN "role_permissions" rp ON rp."roleId" = r.id
  JOIN "permissions" p ON p.id = rp."permissionId"
  GROUP BY r.id
  HAVING BOOL_AND(p."key" LIKE 'wms.%')
)
UPDATE "roles" r
SET "workspace" = 'WMS'
FROM wms_roles
WHERE r.id = wms_roles.id;

UPDATE "user_roles" ur
SET "workspace" = r."workspace"
FROM "roles" r
WHERE r.id = ur."roleId";

-- Existing tenant owners created before direct dynamic role assignment need TENANT_ADMIN once.
INSERT INTO "user_roles" ("userId", "roleId", "workspace", "tenantId", "teamId")
SELECT u.id, r.id, 'ERP', u."tenantId", NULL
FROM "users" u
JOIN "roles" r
  ON r."tenantId" IS NULL
 AND r."key" = 'TENANT_ADMIN'
WHERE u."tenantId" IS NOT NULL
  AND u."role" = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    WHERE ur."userId" = u.id
      AND ur."tenantId" = u."tenantId"
      AND ur."teamId" IS NULL
      AND ur."workspace" = 'ERP'
  );

-- Legacy tenant roles should no longer grant elevated access outside dynamic RBAC.
UPDATE "users"
SET "role" = 'USER'
WHERE "tenantId" IS NOT NULL
  AND "role" = 'VIEWER';

UPDATE "users"
SET "role" = 'USER'
WHERE "tenantId" IS NOT NULL
  AND "role" = 'ADMIN'
  AND EXISTS (
    SELECT 1
    FROM "roles" r
    WHERE r."tenantId" IS NULL
      AND r."key" = 'TENANT_ADMIN'
  );

-- TEAM_MEMBER should no longer exist as a default or fallback role.
DELETE FROM "user_roles"
WHERE "roleId" IN (
  SELECT id
  FROM "roles"
  WHERE "key" = 'TEAM_MEMBER'
);

DELETE FROM "roles"
WHERE "key" = 'TEAM_MEMBER';

-- Keep one tenant-scoped role per user per tenant/workspace.
WITH ranked_tenant_roles AS (
  SELECT
    ur.id,
    ROW_NUMBER() OVER (
      PARTITION BY ur."userId", ur."tenantId", ur."workspace"
      ORDER BY
        CASE WHEN r."isSystem" THEN 1 ELSE 0 END ASC,
        ur."createdAt" DESC,
        ur.id DESC
    ) AS rn
  FROM "user_roles" ur
  JOIN "roles" r ON r.id = ur."roleId"
  WHERE ur."teamId" IS NULL
    AND ur."tenantId" IS NOT NULL
)
DELETE FROM "user_roles" ur
USING ranked_tenant_roles ranked
WHERE ur.id = ranked.id
  AND ranked.rn > 1;

-- Keep one team-scoped role per user per tenant/team/workspace.
WITH ranked_team_roles AS (
  SELECT
    ur.id,
    ROW_NUMBER() OVER (
      PARTITION BY ur."userId", ur."tenantId", ur."teamId", ur."workspace"
      ORDER BY
        CASE WHEN r."isSystem" THEN 1 ELSE 0 END ASC,
        ur."createdAt" DESC,
        ur.id DESC
    ) AS rn
  FROM "user_roles" ur
  JOIN "roles" r ON r.id = ur."roleId"
  WHERE ur."teamId" IS NOT NULL
    AND ur."tenantId" IS NOT NULL
)
DELETE FROM "user_roles" ur
USING ranked_team_roles ranked
WHERE ur.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE "user_roles"
ALTER COLUMN "workspace" SET NOT NULL;

CREATE INDEX "roles_workspace_idx" ON "roles"("workspace");
CREATE INDEX "user_roles_workspace_idx" ON "user_roles"("workspace");

CREATE UNIQUE INDEX "user_roles_one_tenant_role_per_workspace_idx"
ON "user_roles"("userId", "tenantId", "workspace")
WHERE "teamId" IS NULL AND "tenantId" IS NOT NULL;

CREATE UNIQUE INDEX "user_roles_one_team_role_per_workspace_idx"
ON "user_roles"("userId", "tenantId", "teamId", "workspace")
WHERE "teamId" IS NOT NULL AND "tenantId" IS NOT NULL;
