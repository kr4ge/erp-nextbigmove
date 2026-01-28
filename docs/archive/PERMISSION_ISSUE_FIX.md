# Fix: 403 Forbidden When Updating Role Permissions

## Problem
Getting `403 Forbidden` error when trying to update role permissions via:
```
PATCH http://localhost:3001/api/v1/roles/:id
```

## Root Cause
The `/api/v1/roles` endpoints require the `permission.assign` permission, but your current user doesn't have it.

## Solution Options

### Option 1: Grant Permission via Database (Quickest)

**Step 1: Find your user ID and check current permissions**
```sql
-- Find your user
SELECT id, email, role FROM users WHERE email = 'your-email@example.com';

-- Check if you have permission.assign
SELECT
  u.email,
  r.name as role_name,
  p.key as permission_key
FROM users u
LEFT JOIN user_role_assignments ura ON ura."userId" = u.id
LEFT JOIN roles r ON r.id = ura."roleId"
LEFT JOIN role_permissions rp ON rp."roleId" = r.id
LEFT JOIN permissions p ON p.id = rp."permissionId"
WHERE u.email = 'your-email@example.com'
  AND p.key = 'permission.assign';
```

**Step 2: If permission not found, grant it**

**Method A: Using Legacy Admin Role**
```sql
-- If your user has legacy role 'ADMIN', update it to 'SUPER_ADMIN'
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE email = 'your-email@example.com';
```

**Method B: Create Admin Role with Permissions**
```sql
-- 1. Find or create the permission
SELECT id FROM permissions WHERE key = 'permission.assign';
-- Note the permission ID (let's say it's 'perm-id-123')

-- 2. Create an admin role (if not exists)
INSERT INTO roles (id, "tenantId", name, description, "isSystem", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_TENANT_ID',  -- Replace with your tenant ID
  'Tenant Admin',
  'Full administrative access',
  true,
  NOW(),
  NOW()
)
RETURNING id;
-- Note the role ID (let's say it's 'role-id-456')

-- 3. Assign permission to role
INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
VALUES (
  'role-id-456',  -- Role ID from step 2
  'perm-id-123',  -- Permission ID from step 1
  NOW(),
  NOW()
);

-- 4. Assign role to your user (tenant-wide, no team)
INSERT INTO user_role_assignments (id, "userId", "roleId", "tenantId", "teamId", scope, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',    -- Your user ID from Step 1
  'role-id-456',     -- Role ID from step 2
  'YOUR_TENANT_ID',  -- Your tenant ID
  NULL,              -- NULL for tenant-wide
  'TENANT',
  NOW(),
  NOW()
);
```

**Method C: Quick Fix - Assign Multiple Admin Permissions**
```sql
-- Get all admin-related permission IDs
SELECT id, key, name FROM permissions
WHERE key IN ('permission.assign', 'team.manage', 'user.manage', 'role.manage');

-- Create comprehensive admin role
WITH admin_role AS (
  INSERT INTO roles (id, "tenantId", name, description, "isSystem", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid(),
    'YOUR_TENANT_ID',
    'Platform Admin',
    'Full platform administrative access',
    true,
    NOW(),
    NOW()
  )
  RETURNING id
),
admin_perms AS (
  SELECT id FROM permissions
  WHERE key IN ('permission.assign', 'team.manage', 'user.manage', 'role.manage')
)
INSERT INTO role_permissions ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT admin_role.id, admin_perms.id, NOW(), NOW()
FROM admin_role, admin_perms;

-- Then assign this role to your user (replace IDs)
INSERT INTO user_role_assignments (id, "userId", "roleId", "tenantId", "teamId", scope, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',
  (SELECT id FROM roles WHERE name = 'Platform Admin' AND "tenantId" = 'YOUR_TENANT_ID'),
  'YOUR_TENANT_ID',
  NULL,
  'TENANT',
  NOW(),
  NOW()
);
```

### Option 2: Use Super Admin Account

If you have a SUPER_ADMIN user:
1. Login with that account
2. Update the role permissions
3. Switch back to your regular account

### Option 3: Temporarily Disable Permission Check (Development Only)

**⚠️ NOT RECOMMENDED FOR PRODUCTION**

You could temporarily comment out the permission check in the controller:

```typescript
// apps/api/src/modules/roles/roles.controller.ts
@Patch(':id')
// @Permissions('permission.assign')  // Comment this out temporarily
async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
  return this.rolesService.update(id, dto);
}
```

**Remember to uncomment after testing!**

## Verify Fix

After applying any solution, verify it works:

```bash
# Get your auth token (from browser DevTools or login response)

# Try to list roles (should work now)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/v1/roles

# Try to update a role (should work now)
curl -X PATCH -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Role Name"}' \
  http://localhost:3001/api/v1/roles/ROLE_ID
```

## Quick Database Queries

**Find your user and tenant:**
```sql
SELECT id, email, role, "tenantId" FROM users WHERE email = 'your-email@example.com';
```

**Check all permissions you have:**
```sql
SELECT
  u.email,
  u.role as legacy_role,
  r.name as role_name,
  p.key as permission_key,
  p.name as permission_name,
  ura.scope,
  CASE WHEN ura."teamId" IS NULL THEN 'Tenant-wide' ELSE 'Team-specific' END as scope_type
FROM users u
LEFT JOIN user_role_assignments ura ON ura."userId" = u.id
LEFT JOIN roles r ON r.id = ura."roleId"
LEFT JOIN role_permissions rp ON rp."roleId" = r.id
LEFT JOIN permissions p ON p.id = rp."permissionId"
WHERE u.email = 'your-email@example.com'
ORDER BY p.key;
```

**List all available permissions:**
```sql
SELECT key, name, description FROM permissions ORDER BY key;
```

## Recommended Solution

**For Development:**
Use **Method A** (SUPER_ADMIN) - quickest and simplest:
```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'your-email@example.com';
```

**For Production:**
Use **Method B** or **Method C** - create proper admin role with specific permissions and assign to users who need admin access.

## Related Documentation

The role and permission system is part of the RBAC (Role-Based Access Control) implementation. Users need proper permissions to manage roles and permissions.

**Required Permissions for Role Management:**
- `permission.assign` - Required for all role CRUD operations
- `role.manage` - Additional permission for role-specific operations
- `user.manage` - For managing user role assignments

## Still Having Issues?

1. **Clear browser cache and logout/login**
2. **Check API logs** for more detailed error messages:
   ```bash
   # Check API logs
   cd apps/api
   npm run dev
   # Look for permission-related errors
   ```

3. **Verify JWT token** contains correct user info:
   - Go to https://jwt.io
   - Paste your access token
   - Check the payload has correct `userId` and `tenantId`

4. **Check PermissionsGuard** is working:
   ```bash
   # In API logs, you should see permission checks
   # Look for messages like: "Checking permission: permission.assign"
   ```
