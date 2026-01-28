-- FIX: Add permissions to your existing "Tenant Admin" role
-- Since you already have the role assigned, we just need to add permissions to it

-- This adds all admin permissions to the "Tenant Admin" role
INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  r.id as "roleId",
  p.id as "permissionId",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Tenant Admin'
  AND p.key IN (
    'permission.assign',
    'role.manage',
    'user.manage',
    'team.manage',
    'integration.manage',
    'workflow.manage'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Verify what was added
SELECT
  '=== Permissions added to Tenant Admin role ===' as info;

SELECT
  r.name as role_name,
  COUNT(p.key) as permission_count,
  STRING_AGG(p.key, ', ' ORDER BY p.key) as permissions
FROM roles r
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions p ON p.id = rp."permissionId"
WHERE r.name = 'Tenant Admin'
GROUP BY r.name;

SELECT
  '=== NEXT STEP ===' as info,
  'LOGOUT and LOGIN to refresh your JWT token!' as action;
