# Setup Admin Permissions Using Dynamic RBAC

## The Right Way: Using Dynamic RBAC (Not Legacy Roles)

You're correct - we should use the dynamic role and permission system, not the legacy `ADMIN`/`SUPER_ADMIN` roles.

## Quick Setup Script

Run these queries in order to give your user admin permissions:

### Step 1: Find Your User and Tenant

```sql
-- Find your user
SELECT id as user_id, email, "tenantId", role
FROM users
WHERE email = 'your@email.com';  -- Replace with your email

-- Save the user_id and tenantId for next steps
```

### Step 2: Check Existing Permissions

```sql
-- See all available permissions
SELECT id, key, name, description
FROM permissions
ORDER BY key;

-- Find the permission.assign permission specifically
SELECT id FROM permissions WHERE key = 'permission.assign';
```

### Step 3: Create Admin Role (If Doesn't Exist)

```sql
-- Check if you already have an admin role
SELECT id, name, description
FROM roles
WHERE "tenantId" = 'YOUR_TENANT_ID'  -- Replace from Step 1
  AND name ILIKE '%admin%';

-- If no admin role exists, create one:
INSERT INTO roles (id, "tenantId", name, description, "isSystem", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_TENANT_ID',  -- Replace from Step 1
  'Tenant Administrator',
  'Full administrative access to tenant resources',
  true,
  NOW(),
  NOW()
)
RETURNING id, name;

-- Save the role ID returned
```

### Step 4: Assign Permissions to Role

```sql
-- Get all admin-related permissions
SELECT id, key, name
FROM permissions
WHERE key IN (
  'permission.assign',
  'role.manage',
  'user.manage',
  'team.manage',
  'integration.manage',
  'workflow.manage'
);

-- Assign ALL admin permissions to your admin role
-- Replace ROLE_ID with the role ID from Step 3
INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  'YOUR_ROLE_ID',  -- Replace with role ID from Step 3
  id,
  NOW(),
  NOW()
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

-- Verify permissions were assigned
SELECT r.name, p.key, p.name
FROM role_permissions rp
JOIN roles r ON r.id = rp."roleId"
JOIN permissions p ON p.id = rp."permissionId"
WHERE rp."roleId" = 'YOUR_ROLE_ID';  -- Replace with role ID
```

### Step 5: Assign Role to Your User

```sql
-- Assign the admin role to your user at TENANT level (not team-specific)
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
VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',    -- Replace from Step 1
  'YOUR_ROLE_ID',    -- Replace from Step 3
  'YOUR_TENANT_ID',  -- Replace from Step 1
  NULL,              -- NULL = tenant-wide, not team-specific
  'TENANT',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING
RETURNING id;
```

### Step 6: Verify Setup

```sql
-- Check your user's permissions
SELECT
  u.email,
  r.name as role_name,
  ura.scope,
  CASE WHEN ura."teamId" IS NULL THEN 'Tenant-wide' ELSE 'Team-specific' END as assignment_scope,
  p.key as permission_key,
  p.name as permission_name
FROM users u
JOIN user_role_assignments ura ON ura."userId" = u.id
JOIN roles r ON r.id = ura."roleId"
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions p ON p.id = rp."permissionId"
WHERE u.email = 'your@email.com'  -- Replace with your email
ORDER BY p.key;

-- You should see permission.assign and other admin permissions
```

### Step 7: Logout and Login

1. **Logout** from the web app
2. **Login** again (this gets a new JWT with updated permissions)
3. **Try updating roles** - should work now!

---

## All-in-One Script (Replace All Placeholders)

```sql
-- REPLACE THESE VALUES:
-- YOUR_EMAIL: your@email.com
-- Then run this entire script

DO $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_role_id UUID;
  v_email TEXT := 'your@email.com';  -- REPLACE THIS
BEGIN
  -- Get user and tenant
  SELECT id, "tenantId" INTO v_user_id, v_tenant_id
  FROM users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', v_email;
  END IF;

  RAISE NOTICE 'Found user: % (tenant: %)', v_user_id, v_tenant_id;

  -- Create admin role if doesn't exist
  INSERT INTO roles (id, "tenantId", name, description, "isSystem", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    'Tenant Administrator',
    'Full administrative access to tenant resources',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_role_id;

  -- If role already existed, get its ID
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id
    FROM roles
    WHERE "tenantId" = v_tenant_id
      AND name = 'Tenant Administrator';
  END IF;

  RAISE NOTICE 'Admin role ID: %', v_role_id;

  -- Assign all admin permissions to role
  INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
  SELECT
    v_role_id,
    id,
    NOW(),
    NOW()
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

  RAISE NOTICE 'Permissions assigned to role';

  -- Assign role to user
  INSERT INTO user_role_assignments (
    id, "userId", "roleId", "tenantId", "teamId", scope, "createdAt", "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_role_id,
    v_tenant_id,
    NULL,  -- Tenant-wide
    'TENANT',
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Role assigned to user';
  RAISE NOTICE 'Setup complete! User % now has admin permissions.', v_email;
  RAISE NOTICE 'Please LOGOUT and LOGIN again to refresh your JWT token.';
END $$;

-- Verify the setup
SELECT
  u.email,
  r.name as role_name,
  p.key as permission_key
FROM users u
JOIN user_role_assignments ura ON ura."userId" = u.id
JOIN roles r ON r.id = ura."roleId"
JOIN role_permissions rp ON rp."roleId" = r.id
JOIN permissions p ON p.id = rp."permissionId"
WHERE u.email = 'your@email.com'  -- REPLACE THIS
ORDER BY p.key;
```

---

## Using Prisma Studio (Visual Method)

1. **Open Prisma Studio**: `cd apps/api && npx prisma studio`
2. **Go to:** http://localhost:5555

### Create Role:
3. Click **roles** table → **Add record**
4. Fill in:
   - `tenantId`: Your tenant ID
   - `name`: "Tenant Administrator"
   - `description`: "Full admin access"
   - `isSystem`: true
5. **Save** and note the role ID

### Assign Permissions:
6. Click **role_permissions** table → **Add record** (repeat for each permission)
7. Fill in:
   - `roleId`: The role ID from step 5
   - `permissionId`: Find each permission ID from permissions table
8. Add these permissions:
   - permission.assign
   - role.manage
   - user.manage
   - team.manage

### Assign to User:
9. Click **user_role_assignments** table → **Add record**
10. Fill in:
    - `userId`: Your user ID
    - `roleId`: The role ID from step 5
    - `tenantId`: Your tenant ID
    - `teamId`: Leave NULL (for tenant-wide)
    - `scope`: "TENANT"
11. **Save**

### Verify:
12. Click **user_role_assignments** → filter by your userId
13. Should see the assignment

---

## After Setup

1. ✅ **Logout** from web app
2. ✅ **Login** again (gets new JWT)
3. ✅ **Try updating roles** - works!
4. ✅ You now have dynamic RBAC working properly

---

## Why This Is Better

✅ **No hard-coded roles** - Everything is dynamic
✅ **Permission-based** - Not role-name based
✅ **Flexible** - Can create custom roles per tenant
✅ **Scalable** - Easy to add/remove permissions
✅ **Proper RBAC** - Industry standard approach

The legacy `role` column can remain as `USER` or whatever - it's not used for permission checks anymore (except SUPER_ADMIN for platform admins).
