-- Provider credentials are tenant-scoped and managed by the tenant owner.
-- Creative and Advertising retain AI usage but no longer receive connection
-- and workspace-default administration through their system roles.
DELETE FROM "role_permissions" AS rp
USING "roles" AS r, "permissions" AS p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."tenantId" IS NULL
  AND r."workspace" = 'ERP'::"RbacWorkspace"
  AND r."key" IN ('CREATIVE_MANAGER', 'CREATIVE_REVIEWER')
  AND p."key" = 'creative_agent.ai.manage';

UPDATE "permissions"
SET "description" = 'Manage this tenant Creative AI provider connections, defaults, and tenant-wide analysis runs',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'creative_agent.ai.manage';
