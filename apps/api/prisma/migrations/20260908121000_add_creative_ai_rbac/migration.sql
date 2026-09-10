-- Add the two narrow Creative AI permissions without granting them to tenant
-- administrators. Access is opt-in through the existing Creative roles.
INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'creative_agent.ai.use', 'Run AI analysis for permitted Creative Agent records', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.ai.manage', 'View and manage tenant-wide Creative Agent AI runs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Creative users analyze only their own records because the service applies
-- its existing owner scope when read_all is absent.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" = 'CREATIVE_MAKER'
  AND permission_row."key" = 'creative_agent.ai.use'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Advertising and Creative Manager users may analyze and inspect any creative
-- already visible to them inside the tenant.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" IN ('CREATIVE_REVIEWER', 'CREATIVE_MANAGER')
  AND permission_row."key" IN ('creative_agent.ai.use', 'creative_agent.ai.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
