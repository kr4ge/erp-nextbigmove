# Workflow Frontend - 404 Error Fix

## ❌ Problem

The workflows page was getting a 404 error:
```
GET http://localhost:3001/api/workflows 404 (Not Found)
```

## 🔍 Root Cause

The frontend was calling `/api/workflows` but the API uses the prefix `/api/v1`:

```typescript
// In main.ts
app.setGlobalPrefix('api/v1');
```

So the correct endpoint is: `http://localhost:3001/api/v1/workflows`

## ✅ Solution

Updated the workflows page to use the existing `apiClient` utility instead of raw fetch:

**Before:**
```typescript
const response = await fetch('http://localhost:3001/api/workflows', {
  headers: {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId || '',
  },
});
```

**After:**
```typescript
import apiClient from '@/lib/api-client';

const response = await apiClient.get('/workflows');
```

## 🎯 Benefits of Using apiClient

The `apiClient` utility ([lib/api-client.ts](apps/web/src/lib/api-client.ts)) provides:

1. ✅ **Correct base URL**: `http://localhost:3001/api/v1`
2. ✅ **Auto token injection**: Automatically adds `Authorization` header from localStorage
3. ✅ **Auto tenant ID**: Automatically adds `X-Tenant-ID` header from localStorage
4. ✅ **401 handling**: Automatically redirects to `/login` on unauthorized
5. ✅ **Environment support**: Uses `NEXT_PUBLIC_API_URL` env var in production

## 🚀 Testing

1. Make sure your API is running:
   ```bash
   cd apps/api
   npm run start:dev
   ```

2. Make sure your web app is running:
   ```bash
   cd apps/web
   npm run dev
   ```

3. Navigate to: **http://localhost:3000/workflows**

4. You should now see:
   - **Empty state** if no workflows exist: "No workflows yet" with "Create Workflow" button
   - **Workflows list** if workflows exist

## ✅ Fixed Files

- [apps/web/src/app/workflows/page.tsx](apps/web/src/app/workflows/page.tsx)
  - Changed from `fetch()` to `apiClient.get()`
  - Removed manual header management
  - Better error handling

## 📝 API Endpoints

All workflow API endpoints are available at:

```
Base URL: http://localhost:3001/api/v1

GET    /workflows                                    # List all workflows
POST   /workflows                                    # Create workflow
GET    /workflows/:id                                # Get workflow
PATCH  /workflows/:id                                # Update workflow
DELETE /workflows/:id                                # Delete workflow
POST   /workflows/:id/enable                         # Enable workflow
POST   /workflows/:id/disable                        # Disable workflow
POST   /workflows/:id/trigger                        # Trigger manual execution
GET    /workflows/:id/executions                     # List executions
GET    /workflows/:workflowId/executions/:executionId  # Get execution
POST   /workflows/:workflowId/executions/:executionId/cancel  # Cancel execution
```

## 🔒 Authentication

All endpoints require:
- **Authorization header**: `Bearer <access_token>`
- **Tenant header**: `X-Tenant-ID: <tenant_id>`

The `apiClient` handles this automatically.

---

**Status**: ✅ **FIXED** - Workflows page now correctly calls `/api/v1/workflows`
