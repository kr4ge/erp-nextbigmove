-- SIMPLEST FIX: Just replace YOUR_EMAIL with your actual email address
-- Then run this entire script

-- ⚠️ REPLACE THIS EMAIL ⚠️
DO $$
DECLARE
  v_email TEXT := 'wetrade.frage@gmail.com';  -- ⚠️ CHANGE THIS TO YOUR EMAIL ⚠️
  v_user_id UUID;
  v_tenant_id UUID;
  v_role_id UUID;
  v_perm_count INT;
BEGIN
  -- Find user
  SELECT id, "tenantId" INTO v_user_id, v_tenant_id
  FROM users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Please check the email address.', v_email;
  END IF;

  RAISE NOTICE '✓ Found user: % (ID: %)', v_email, v_user_id;

  -- Create or get admin role
  INSERT INTO roles (id, "tenantId", name, description, "isSystem", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    'Tenant Administrator',
    'Full admin access',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_role_id
  FROM roles
  WHERE "tenantId" = v_tenant_id AND name = 'Tenant Administrator'
  LIMIT 1;

  RAISE NOTICE '✓ Admin role ID: %', v_role_id;

  -- Assign permissions to role
  INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
  SELECT v_role_id, id, NOW(), NOW()
  FROM permissions
  WHERE key IN (
    'permission.assign',
    'role.manage',
    'user.manage',
    'team.manage',
    'integration.manage',
    'workflow.manage'
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_perm_count = ROW_COUNT;
  RAISE NOTICE '✓ Assigned % permissions to role', v_perm_count;

  -- Assign role to user
  INSERT INTO user_role_assignments (
    id, "userId", "roleId", "tenantId", "teamId", scope, "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_role_id,
    v_tenant_id,
    NULL,
    'TENANT',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ Role assigned to user';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User: %', v_email;
  RAISE NOTICE 'Role: Tenant Administrator';
  RAISE NOTICE 'Permissions: permission.assign, role.manage, user.manage, team.manage, etc.';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: LOGOUT and LOGIN again to refresh your JWT token!';
  RAISE NOTICE '========================================';
END $$;

-- Verify permissions
SELECT
  '=== Your Permissions ===' as section,
  u.email,
  r.name as role,
  STRING_AGG(p.key, ', ' ORDER BY p.key) as permissions
FROM users u
JOIN user_role_assignments ura ON ura."userId" = u.id
JOIN roles r ON r.id = ura."roleId"
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions p ON p.id = rp."permissionId"
WHERE u.email = 'admin@example.com'  -- ⚠️ CHANGE THIS TOO ⚠️
GROUP BY u.email, r.name;
