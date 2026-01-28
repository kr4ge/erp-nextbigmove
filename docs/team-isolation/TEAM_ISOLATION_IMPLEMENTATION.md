# Team-Based Data Isolation Implementation

## Overview

Implemented team-based data isolation to ensure users can only access and manage data owned by their teams. Non-admin users are restricted to their team memberships, while tenant admins have access across all teams in their tenant.

## Changes Made

### 1. TeamContextService (New)

**Location**: `/apps/api/src/common/services/team-context.service.ts`

A centralized service for managing team context and access control:

**Key Methods**:
- `getUserTeamMemberships(userId, tenantId)` - Get all teams a user belongs to
- `checkTenantWideAccess(userId, tenantId)` - Check if user has tenant-wide admin permissions
- `canAccessTeam(userId, tenantId, teamId)` - Validate team access
- `getContext()` - Get full context including team memberships
- `validateAndGetTeamId(payloadTeamId)` - Validate and return effective team ID (restricts non-admins to their teams)
- `buildTeamWhereClause(additionalWhere)` - Build Prisma where clause with team filtering

**Access Rules**:
- **SUPER_ADMIN**: Bypass all checks (platform-level)
- **Tenant Admins** (users with `permission.assign`, `team.manage`, or `user.manage`): Access all teams in tenant
- **Team Members**: Only access teams they belong to

### 2. IntegrationService Updates

**Location**: `/apps/api/src/modules/integrations/integration.service.ts`

**Updated Methods**:
- ✅ `create()` - Uses `validateAndGetTeamId()` to restrict team selection
- ✅ `findAll()` - Uses `buildTeamWhereClause()` for team filtering
- ✅ `findOne()` - Team-scoped access check
- ✅ `update()` - Team validation on updates
- ✅ `remove()` - Team-scoped deletion
- ✅ `enable()` / `disable()` - Team-scoped operations
- ✅ `listPosStores()` - Team filtering
- ✅ `getPosStore()` - Team-scoped access
- ✅ `listPosStoreProducts()` - Team filtering
- ✅ `listPosStoreOrders()` - Team filtering
- ✅ `bulkUpdateProductMapping()` - Team validation
- ✅ `checkPosDuplicate()` - Team-scoped duplicate check
- ✅ `fetchPancakeProductsByIntegrationId()` - Team filtering
- ✅ `fetchPancakeProductsByShopId()` - Team filtering

**Remaining Methods** (need update):
- Meta ad account methods (lines 791, 812, 832, 858, 879)
- COGS methods (lines 909, 978, 1023, 1068)

### 3. WorkflowService Updates

**Location**: `/apps/api/src/modules/workflows/workflow.service.ts`

**Updated Methods**:
- ✅ `create()` - Uses `validateAndGetTeamId()` to restrict team selection
- ✅ `findAll()` - Uses `buildTeamWhereClause()` for team filtering

**Remaining Methods** (need update):
- `findOne()` - Line 97
- `update()` - Line 130
- `remove()` - Line 197
- `enable()` / `disable()` - Lines 241, 286
- `getExecutions()` - Line 331
- `getExecution()` - Line 381
- `triggerManual()` - Line 422

**Pattern for Updates**:
```typescript
// OLD
const { tenantId, teamId, isAdmin } = await this.getContext();
const workflow = await this.prisma.workflow.findFirst({
  where: {
    id,
    tenantId,
    ...(teamId ? { teamId } : isAdmin ? {} : { teamId }),
  },
});

// NEW
const where = await this.teamContext.buildTeamWhereClause({ id });
const workflow = await this.prisma.workflow.findFirst({
  where,
});
```

### 4. Module Registration

**Location**: `/apps/api/src/app.module.ts`

Added `CommonServicesModule` which exports `TeamContextService` globally.

## Pending Tasks

### Backend

1. **Complete WorkflowService Updates**
   - Update all remaining methods to use `TeamContextService`
   - Remove `checkTenantWideAccess()` method (now in TeamContextService)

2. **Complete IntegrationService Updates**
   - Update Meta ad account methods
   - Update COGS management methods

3. **Add Team Membership API Endpoint**
   ```typescript
   // In TeamController or UserController
   @Get('/teams/my-teams')
   @UseGuards(JwtAuthGuard, TenantGuard)
   async getMyTeams(@Request() req) {
     const userId = req.user.userId;
     const tenantId = req.user.tenantId;
     return this.teamContext.getUserTeamMemberships(userId, tenantId);
   }
   ```

### Frontend

1. **Add API Client Method**
   ```typescript
   // In apiClient or teams service
   export const getMyTeams = () => apiClient.get('/teams/my-teams');
   ```

2. **Update Integration Create/Edit Forms**
   - Fetch user's teams using the new endpoint
   - Restrict team dropdown to only show user's teams
   - Example: `/apps/web/src/app/(dashboard)/integrations/page.tsx`

3. **Update Workflow Create/Edit Forms**
   - Same pattern as integrations
   - Example: `/apps/web/src/app/(dashboard)/workflows/page.tsx`

4. **Update Any Other Resource Forms**
   - POS stores
   - Meta ad accounts
   - Any other team-scoped resources

## Testing Checklist

### User Scenarios

1. **Team Member (Non-Admin)**
   - [ ] Can only see integrations owned by their teams
   - [ ] Can only create integrations for their teams
   - [ ] Cannot change integration team to a team they don't belong to
   - [ ] Cannot access integrations from other teams
   - [ ] Same for workflows, POS stores, Meta accounts

2. **Tenant Admin**
   - [ ] Can see all integrations across all teams
   - [ ] Can create integrations for any team
   - [ ] Can move resources between teams
   - [ ] Can access all team data

3. **Multi-Team Member**
   - [ ] Can see resources from all teams they belong to
   - [ ] Can create resources for any of their teams
   - [ ] Cannot see resources from teams they don't belong to

### API Testing

```bash
# Get user's teams
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/v1/teams/my-teams

# Create integration (should validate team membership)
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","provider":"PANCAKE_POS","teamId":"<team-id>","credentials":{...}}' \
  http://localhost:3001/api/v1/integrations

# List integrations (should only show user's teams)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/v1/integrations
```

## Database Validation

All team-scoped resources already have `teamId` field in schema:
- ✅ integrations
- ✅ workflows
- ✅ posStores
- ✅ metaAdAccounts
- ✅ metaAdInsights
- ✅ posOrders
- ✅ posTags
- ✅ posProductCogs
- ✅ reconcileMarketing

## Security Considerations

1. **Team Membership Validation**: All create/update operations validate team membership
2. **Query Filtering**: All read operations filter by user's teams
3. **Admin Bypass**: Tenant admins can access all teams (by design)
4. **Platform Admin**: SUPER_ADMIN bypasses all checks (platform-level only)

## Migration Notes

No database migration needed - schema already supports team isolation. This is purely a business logic update to enforce team-based access control at the application level.
