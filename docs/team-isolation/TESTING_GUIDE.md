# Team-Based Data Isolation - Testing Guide

## ✅ Backend Implementation Complete

All backend services have been updated to enforce team-based data isolation:
- ✅ TeamContextService created
- ✅ IntegrationService (all methods)
- ✅ WorkflowService (all methods)
- ✅ Meta ad account methods
- ✅ COGS management methods
- ✅ API endpoint `/teams/my-teams` added

## 🧪 How to Test

### Prerequisites

1. **Start your backend server**
   ```bash
   cd apps/api
   npm run dev
   ```

2. **You'll need at least 3 test users:**
   - **User A**: Regular team member (belongs to Team 1 only)
   - **User B**: Multi-team member (belongs to Team 1 and Team 2)
   - **User C**: Tenant admin (has `permission.assign`, `team.manage`, or `user.manage` permission)

### Test Scenario 1: Team Member Can Only See Their Teams

**Test as User A (Team 1 member only)**

1. **Get your teams**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/teams/my-teams
   ```

   **Expected**: Should return only Team 1
   ```json
   [
     {
       "id": "team-1-id",
       "name": "Team 1",
       "description": "...",
       "status": "ACTIVE"
     }
   ]
   ```

2. **List integrations**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: Should only see integrations owned by Team 1

3. **Try to create integration for Team 2 (should fail)**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Integration",
       "provider": "PANCAKE_POS",
       "teamId": "<TEAM_2_ID>",
       "credentials": {
         "apiKey": "test-key",
         "shopId": "123"
       }
     }' \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: 403 Forbidden - "You do not have access to this team"

4. **Create integration for Team 1 (should succeed)**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Team 1 Integration",
       "provider": "PANCAKE_POS",
       "teamId": "<TEAM_1_ID>",
       "credentials": {
         "apiKey": "team1-key",
         "shopId": "456"
       }
     }' \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: 201 Created with integration details

5. **Try to access integration from Team 2 (should fail)**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/integrations/<TEAM_2_INTEGRATION_ID>
   ```

   **Expected**: 404 Not Found

### Test Scenario 2: Multi-Team Member Can See All Their Teams

**Test as User B (Team 1 and Team 2 member)**

1. **Get your teams**
   ```bash
   curl -H "Authorization: Bearer <USER_B_TOKEN>" \
     http://localhost:3001/api/v1/teams/my-teams
   ```

   **Expected**: Should return both Team 1 and Team 2
   ```json
   [
     {
       "id": "team-1-id",
       "name": "Team 1",
       ...
     },
     {
       "id": "team-2-id",
       "name": "Team 2",
       ...
     }
   ]
   ```

2. **List integrations**
   ```bash
   curl -H "Authorization: Bearer <USER_B_TOKEN>" \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: Should see integrations from both Team 1 and Team 2

3. **Create integration for Team 1**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_B_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "User B Team 1 Integration",
       "provider": "PANCAKE_POS",
       "teamId": "<TEAM_1_ID>",
       "credentials": {"apiKey": "key", "shopId": "123"}
     }' \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: 201 Created

4. **Create integration for Team 2**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_B_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "User B Team 2 Integration",
       "provider": "PANCAKE_POS",
       "teamId": "<TEAM_2_ID>",
       "credentials": {"apiKey": "key2", "shopId": "789"}
     }' \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: 201 Created

### Test Scenario 3: Tenant Admin Can See All Teams

**Test as User C (Tenant admin with permission.assign)**

1. **Get your teams**
   ```bash
   curl -H "Authorization: Bearer <USER_C_TOKEN>" \
     http://localhost:3001/api/v1/teams/my-teams
   ```

   **Expected**: Returns teams the admin belongs to (or all teams if using /teams endpoint)

2. **List integrations**
   ```bash
   curl -H "Authorization: Bearer <USER_C_TOKEN>" \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: Should see integrations from ALL teams in the tenant

3. **Create integration for any team**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_C_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Admin Integration",
       "provider": "PANCAKE_POS",
       "teamId": "<ANY_TEAM_ID>",
       "credentials": {"apiKey": "admin-key", "shopId": "999"}
     }' \
     http://localhost:3001/api/v1/integrations
   ```

   **Expected**: 201 Created (admin can create for any team)

4. **Access integration from any team**
   ```bash
   curl -H "Authorization: Bearer <USER_C_TOKEN>" \
     http://localhost:3001/api/v1/integrations/<ANY_INTEGRATION_ID>
   ```

   **Expected**: 200 OK with integration details

### Test Scenario 4: Workflows Follow Same Rules

**Test as User A (Team 1 member only)**

1. **List workflows**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/workflows
   ```

   **Expected**: Only workflows from Team 1

2. **Create workflow for Team 1**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Team 1 Workflow",
       "description": "Test workflow",
       "teamId": "<TEAM_1_ID>",
       "schedule": "0 0 * * *",
       "config": {}
     }' \
     http://localhost:3001/api/v1/workflows
   ```

   **Expected**: 201 Created

3. **Try to create workflow for Team 2 (should fail)**
   ```bash
   curl -X POST -H "Authorization: Bearer <USER_A_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Team 2 Workflow",
       "teamId": "<TEAM_2_ID>",
       "schedule": "0 0 * * *",
       "config": {}
     }' \
     http://localhost:3001/api/v1/workflows
   ```

   **Expected**: 403 Forbidden

### Test Scenario 5: POS Stores, Meta Ad Accounts, COGS

**Test as User A (Team 1 member)**

1. **List POS stores**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/integrations/pos/stores
   ```

   **Expected**: Only stores from Team 1

2. **List Meta ad accounts**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/integrations/meta/accounts
   ```

   **Expected**: Only accounts from Team 1

3. **Try to access Team 2 store (should fail)**
   ```bash
   curl -H "Authorization: Bearer <USER_A_TOKEN>" \
     http://localhost:3001/api/v1/integrations/pos/stores/<TEAM_2_STORE_ID>
   ```

   **Expected**: 404 Not Found

## 🔍 Database Validation

You can verify team isolation directly in the database:

```sql
-- Check team memberships for a user
SELECT
  u.email,
  t.name as team_name,
  tm.status
FROM team_memberships tm
JOIN users u ON u.id = tm."userId"
JOIN teams t ON t.id = tm."teamId"
WHERE u.email = 'user-a@example.com';

-- Check integrations and their teams
SELECT
  i.name,
  i.provider,
  t.name as team_name,
  i.enabled
FROM integrations i
LEFT JOIN teams t ON t.id = i."teamId"
WHERE i."tenantId" = '<YOUR_TENANT_ID>';

-- Check workflows and their teams
SELECT
  w.name,
  t.name as team_name,
  w.enabled
FROM workflows w
LEFT JOIN teams t ON t.id = w."teamId"
WHERE w."tenantId" = '<YOUR_TENANT_ID>';
```

## ⚠️ Common Issues and Troubleshooting

### Issue: User gets 403 Forbidden when creating resources

**Cause**: User is trying to assign a teamId they don't belong to

**Solution**:
1. Verify user's team memberships: `GET /teams/my-teams`
2. Ensure teamId in request matches one of user's teams
3. Check if user has tenant-wide admin permissions

### Issue: User can't see any data

**Cause**: User has no team memberships

**Solution**:
1. Add user to at least one team via the teams API or database
2. Verify membership status is 'ACTIVE'

### Issue: Admin can't see all teams

**Cause**: Admin doesn't have the right permissions

**Solution**:
1. Verify admin has one of these permissions:
   - `permission.assign`
   - `team.manage`
   - `user.manage`
2. Check role assignments are at tenant level (teamId should be null)

## 📊 Success Criteria

Your team isolation is working correctly if:

- ✅ Regular users can only see/create resources for teams they belong to
- ✅ Multi-team users can access resources from all their teams
- ✅ Tenant admins can see and manage all teams
- ✅ Users get 403 Forbidden when trying to access other teams' resources
- ✅ `/teams/my-teams` returns only teams the user belongs to
- ✅ Creating resources without teamId uses user's default team (if applicable)

## 🎯 Next Steps After Testing

Once backend testing is complete:

### 1. Frontend Updates (CRITICAL)

Update your frontend forms to use the new `/teams/my-teams` endpoint:

**Files to Update:**
- Integration create/edit forms
- Workflow create/edit forms
- Any other resource forms that have team dropdowns

**Example Update:**
```typescript
// In your integration form component
const [myTeams, setMyTeams] = useState([]);

useEffect(() => {
  const fetchTeams = async () => {
    const response = await apiClient.get('/teams/my-teams');
    setMyTeams(response.data);
  };
  fetchTeams();
}, []);

// In your form's team dropdown
<select name="teamId" required>
  {myTeams.map(team => (
    <option key={team.id} value={team.id}>
      {team.name}
    </option>
  ))}
</select>
```

### 2. User Experience Testing

After frontend updates:
1. Log in as different user types
2. Verify team dropdowns only show accessible teams
3. Create resources and verify ownership
4. Test multi-team scenarios

### 3. Data Migration (If Needed)

If you have existing data without teamId:

```sql
-- Find integrations without team assignment
SELECT id, name, "tenantId"
FROM integrations
WHERE "teamId" IS NULL;

-- Assign to default team (run carefully!)
UPDATE integrations
SET "teamId" = (
  SELECT id FROM teams
  WHERE "tenantId" = integrations."tenantId"
  LIMIT 1
)
WHERE "teamId" IS NULL;
```

## 🎉 You're All Set!

The backend implementation is complete and ready for testing. Follow the scenarios above to verify everything works as expected.
