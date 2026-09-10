-- Advertising owns the unmatched-Meta-ad workflow. Granting ENROLL allows
-- the default role to load eligible store items and enroll the selected ad as
-- a new creative. The insert is idempotent and preserves every existing role
-- assignment and permission.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" = 'CREATIVE_REVIEWER'
  AND permission_row."key" = 'creative_agent.enroll'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
