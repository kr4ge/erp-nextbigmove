-- TENANT_ADMIN is the current tenant-owner role. Give owners access to tenant
-- AI policy settings without granting Creative registry or asset visibility.
UPDATE "permissions"
SET "description" = 'Manage tenant Creative AI settings and tenant-wide analysis runs',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'creative_agent.ai.manage';

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" = 'TENANT_ADMIN'
  AND role_row."workspace" = 'ERP'
  AND permission_row."key" = 'creative_agent.ai.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
