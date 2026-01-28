# Role-Based Access Control (RBAC) Architecture

## Overview

This ERP system implements a **two-tier RBAC architecture** that separates platform-level administration from tenant-level access control. This design provides clear separation of concerns and flexible permission management.

## Architecture Layers

### 1. Platform Layer (SUPER_ADMIN Only)

**Purpose**: Platform operations and multi-tenant management

**Role**:
- `SUPER_ADMIN` - Platform administrators who manage the entire system

**Capabilities**:
- Manage all tenants across the platform
- Create and modify system-wide roles
- Access any tenant's data (for support/admin purposes)
- Bypass tenant-level permission checks

**Key Characteristics**:
- **NOT** a tenant user - operates at platform level
- Does not require tenant context for authentication
- Used by platform operators, not end users

---

### 2. Tenant Layer (Permission-Based)

**Purpose**: All access control within a tenant

**Philosophy**: **NO hardcoded role checks** - all access is controlled through dynamic permissions assigned to roles.

**Key Roles**:
- `TENANT_ADMIN` - Full administrative access within the tenant
- `TEAM_LEAD` - Team-level management capabilities
- `TEAM_MEMBER` - Limited team member access
- **Custom Roles** - Tenant admins can create roles with any permission combination

**Key Characteristics**:
- All access controlled by **permissions**, not role names
- Completely flexible and customizable per tenant
- No special treatment for any role (including former `ADMIN` role)

---

## Permission System

### Core Permissions

#### Tenant Management
- `tenant.manage` - Manage tenant settings and configuration

#### Team Management
- `team.manage` - Create, update, and delete teams
- `team.read` - View team information

#### User Management
- `user.manage` - Create, update, and delete users
- `user.read` - View user information

#### Role & Permission Management
- `permission.assign` - Assign roles and permissions (grants access to /roles page)
- `role.read` - View roles and permissions

#### Integration Management
- `integration.create` - Create new integrations
- `integration.read` - View integrations
- `integration.update` - Modify integrations
- `integration.delete` - Remove integrations
- `integration.test` - Test integration connections

#### Workflow Management
- `workflow.create` - Create workflows
- `workflow.read` - View workflows
- `workflow.update` - Modify workflows
- `workflow.delete` - Remove workflows
- `workflow.execute` - Execute workflows
- `workflow.view_executions` - View workflow execution history

#### Data Access
- `pos.read` - Read POS data (stores, orders, products)
- `pos.cogs.manage` - Manage cost of goods sold
- `meta.read` - Read Meta advertising data
- `analytics.marketing` - Access marketing analytics dashboards
- `analytics.sales` - Access sales analytics dashboards

---

## How It Works

### Backend (NestJS)

#### 1. PermissionsGuard

**Location**: `/apps/api/src/common/guards/permissions.guard.ts`

**Purpose**: Enforce permission-based access control

**Logic**:
```typescript
// Platform admins bypass all checks
if (user.role === 'SUPER_ADMIN') {
  return true;
}

// All tenant users checked against their permissions
const effectivePermissions = getUserEffectivePermissions(user);
if (!effectivePermissions.includes(requiredPermission)) {
  throw ForbiddenException();
}
```

**Key Points**:
- Only `SUPER_ADMIN` bypasses checks
- All tenant users (including TENANT_ADMIN) are checked against permissions
- Permissions are computed from role assignments + user-specific overrides

#### 2. TenantGuard

**Location**: `/apps/api/src/common/guards/tenant.guard.ts`

**Purpose**: Ensure tenant context and validate tenant status

**Logic**:
```typescript
// SUPER_ADMIN doesn't need tenant context
if (user.role === 'SUPER_ADMIN') {
  return true;
}

// All tenant users must have valid tenant context
if (!user.tenantId) {
  throw ForbiddenException('Tenant context required');
}

// Verify tenant is active
const tenant = await getTenant(user.tenantId);
if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
  throw ForbiddenException('Tenant not active');
}
```

#### 3. Permission Computation

**Location**: `/apps/api/src/modules/auth/auth.controller.ts` - `GET /auth/permissions`

**Process**:
1. Find all role assignments for the user (tenant-scoped, `teamId: null`)
2. Aggregate all permissions from assigned roles
3. Apply user-specific permission overrides (allow/deny)
4. Return final set of effective permissions

**Example**:
```typescript
// User assigned TENANT_ADMIN role
// TENANT_ADMIN has: tenant.manage, team.manage, user.manage, permission.assign, ...

// User-specific override: deny permission.assign
// Final permissions: tenant.manage, team.manage, user.manage (no permission.assign)
```

### Frontend (Next.js)

#### Permission Checking Pattern

All admin pages (`/users`, `/teams`, `/roles`) follow this pattern:

```typescript
useEffect(() => {
  // Fetch user's effective permissions
  const response = await apiClient.get('/auth/permissions');
  const permissions = response.data.permissions || [];

  // Check for specific permission
  const hasPermission = permissions.includes('user.manage');
  setCanManage(hasPermission);
}, [user]);
```

**No Role Checks**: Frontend never checks `user.role === 'ADMIN'` or similar. Only permission checks.

#### Page-Permission Mapping

| Page | Required Permission |
|------|-------------------|
| `/users` | `user.manage` |
| `/teams` | `team.manage` |
| `/roles` | `permission.assign` |

---

## Migration from Old System

### Old Architecture (Deprecated)
```
ADMIN role → Hardcoded full access
USER role → Limited access
```

### New Architecture
```
SUPER_ADMIN → Platform-level only
TENANT_ADMIN → permission.assign, user.manage, team.manage, ...
TEAM_LEAD → user.manage, team.manage
TEAM_MEMBER → Limited permissions
```

### Migration Steps

If you have users with the old `ADMIN` role:

1. **Assign TENANT_ADMIN Role**:
   ```sql
   -- Get the TENANT_ADMIN role ID
   SELECT id FROM roles WHERE key = 'TENANT_ADMIN';

   -- Assign to the user
   INSERT INTO user_role_assignments (userId, roleId, tenantId, teamId)
   VALUES ('user-id', 'tenant-admin-role-id', 'tenant-id', NULL);
   ```

2. **Update User's Legacy Role** (optional):
   ```sql
   UPDATE users SET role = 'USER' WHERE id = 'user-id';
   ```

3. **Verify Permissions**:
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:3001/api/v1/auth/permissions
   ```

---

## Best Practices

### 1. Never Check Roles in Code

❌ **Wrong**:
```typescript
if (user.role === 'ADMIN' || user.role === 'TENANT_ADMIN') {
  // allow access
}
```

✅ **Correct**:
```typescript
@Permissions('user.manage')
async manageUser() {
  // Permission guard automatically checks
}
```

### 2. Use Permission Decorators

All protected endpoints should use the `@Permissions()` decorator:

```typescript
@Get()
@Permissions('user.read')
async getUsers() {
  return this.userService.findAll();
}

@Post()
@Permissions('user.manage')
async createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

### 3. Tenant-Scoped vs Team-Scoped

**Tenant-Scoped** (`teamId: null`):
- Used for admin pages (/users, /roles, /teams)
- Access across entire tenant
- Example: TENANT_ADMIN role assignment

**Team-Scoped** (`teamId: specific-team-id`):
- Used for team-level operations
- Access limited to specific team
- Example: TEAM_LEAD role assignment for Team A

### 4. Custom Roles

Tenants can create custom roles with any combination of permissions:

```typescript
// Example: Create a "Marketing Manager" role
await rolesService.create({
  name: 'Marketing Manager',
  key: 'MARKETING_MANAGER',
  description: 'Manages marketing campaigns',
  permissionKeys: [
    'meta.read',
    'analytics.read',
    'integration.read',
  ]
});
```

---

## Troubleshooting

### User Can't Access Admin Pages

1. **Check Permissions**:
   ```bash
   GET /auth/permissions
   ```

2. **Verify Role Assignment**:
   ```sql
   SELECT * FROM user_role_assignments
   WHERE userId = 'user-id' AND teamId IS NULL;
   ```

3. **Check Role Permissions**:
   ```sql
   SELECT p.key
   FROM role_permissions rp
   JOIN permissions p ON p.id = rp.permissionId
   WHERE rp.roleId = 'role-id';
   ```

### Permission Changes Not Reflecting

- **Frontend**: Clear localStorage and re-login
- **Backend**: Permission changes are immediate (no caching)

### SUPER_ADMIN Issues

- SUPER_ADMIN should NOT be assigned to tenant users
- SUPER_ADMIN bypasses all permission checks
- Use TENANT_ADMIN for tenant administrators instead

---

## API Reference

### Get User Permissions

```http
GET /api/v1/auth/permissions
Authorization: Bearer <token>
```

**Response**:
```json
{
  "permissions": [
    "user.manage",
    "team.manage",
    "permission.assign",
    "integration.read",
    ...
  ]
}
```

### List All Roles

```http
GET /api/v1/roles
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "id": "role-id",
    "name": "Tenant Admin",
    "key": "TENANT_ADMIN",
    "isSystem": true,
    "permissions": ["user.manage", "team.manage", ...]
  },
  ...
]
```

### Create Custom Role

```http
POST /api/v1/roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Custom Role",
  "key": "CUSTOM_ROLE",
  "description": "Description here",
  "permissionKeys": ["user.read", "team.read"]
}
```

---

## Security Considerations

1. **Least Privilege**: Grant minimum permissions needed
2. **Regular Audits**: Review role assignments periodically
3. **Permission Overrides**: Use sparingly, prefer role-based grants
4. **SUPER_ADMIN**: Reserve for platform operators only
5. **Tenant Isolation**: All tenant data is strictly isolated

---

## Summary

### Platform Layer
- **Role**: SUPER_ADMIN
- **Purpose**: Platform management
- **Access**: Bypasses all checks

### Tenant Layer
- **Roles**: Dynamic (TENANT_ADMIN, TEAM_LEAD, custom roles)
- **Purpose**: Tenant-specific access control
- **Access**: 100% permission-based, zero hardcoded role checks

This architecture provides the flexibility of dynamic permissions while maintaining clear separation between platform and tenant concerns.
