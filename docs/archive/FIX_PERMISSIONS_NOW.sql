-- IMMEDIATE FIX: Grant admin permissions using dynamic RBAC
-- This will give the most recently created user full admin permissions

-- IMPORTANT: Review the output and make sure it's targeting the right user!

BEGIN;

-- Step 1: Find the most recent user (likely you)
WITH target_user AS (
  SELECT id as user_id, email, "tenantId"
  FROM users
  ORDER BY "createdAt" DESC
  LIMIT 1
),
-- Step 2: Ensure we have an admin role for this tenant
admin_role AS (
  INSERT INTO roles (id, "tenantId", name, description, "isSystem", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    t."tenantId",
    'Tenant Administrator',
    'Full administrative access to manage roles, permissions, users, and teams',
    true,
    NOW(),
    NOW()
  FROM target_user t
  WHERE NOT EXISTS (
    SELECT 1 FROM roles r
    WHERE r."tenantId" = t."tenantId"
    AND r.name = 'Tenant Administrator'
  )
  RETURNING id, "tenantId", name
),
existing_admin_role AS (
  SELECT r.id, r."tenantId", r.name
  FROM roles r
  JOIN target_user t ON t."tenantId" = r."tenantId"
  WHERE r.name = 'Tenant Administrator'
),
combined_role AS (
  SELECT * FROM admin_role
  UNION ALL
  SELECT * FROM existing_admin_role
  LIMIT 1
),
-- Step 3: Assign all critical permissions to the admin role
assigned_permissions AS (
  INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
  SELECT
    cr.id,
    p.id,
    NOW(),
    NOW()
  FROM combined_role cr
  CROSS JOIN permissions p
  WHERE p.key IN (
    'permission.assign',
    'role.manage',
    'user.manage',
    'team.manage',
    'integration.manage',
    'workflow.manage'
  )
  ON CONFLICT ("roleId", "permissionId") DO NOTHING
  RETURNING "roleId", "permissionId"
),
-- Step 4: Assign the role to the user (tenant-wide, not team-specific)
user_assignment AS (
  INSERT INTO user_role_assignments (
    id,
    "userId",
    "roleId",
    "tenantId",
    "teamId",
    scope,
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    tu.user_id,
    cr.id,
    tu."tenantId",
    NULL,  -- NULL means tenant-wide, not team-specific
    'TENANT',
    NOW(),
    NOW()
  FROM target_user tu
  CROSS JOIN combined_role cr
  ON CONFLICT DO NOTHING
  RETURNING id, "userId", "roleId"
)
-- Show what was done
SELECT
  tu.email as "User Email",
  cr.name as "Role Assigned",
  'Tenant-wide' as "Scope",
  (SELECT COUNT(*) FROM assigned_permissions) as "Permissions Added",
  CASE
    WHEN EXISTS (SELECT 1 FROM user_assignment)
    THEN 'Role assigned to user'
    ELSE 'Role was already assigned'
  END as "Status"
FROM target_user tu
CROSS JOIN combined_role cr;

COMMIT;

-- Verify the setup
SELECT
  '=== VERIFICATION: Your Current Permissions ===' as info;

SELECT
  u.email as "User",
  r.name as "Role",
  ura.scope as "Scope",
  COUNT(DISTINCT p.key) as "Permission Count",
  STRING_AGG(DISTINCT p.key, ', ' ORDER BY p.key) as "Permissions"
FROM users u
JOIN user_role_assignments ura ON ura."userId" = u.id
JOIN roles r ON r.id = ura."roleId"
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions p ON p.id = rp."permissionId"
WHERE u.id = (SELECT id FROM users ORDER BY "createdAt" DESC LIMIT 1)
GROUP BY u.email, r.name, ura.scope;

SELECT
  '=== NEXT STEP ===' as info,
  'LOGOUT from the web app and LOGIN again to refresh your JWT token!' as action;
