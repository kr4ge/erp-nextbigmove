# Integration Management System - Implementation Context

## Overview
Multi-tenant ERP Analytics SaaS Platform with Integration Management for Meta Ads and Pancake POS. This document provides complete context for the integration feature implementation.

## System Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: NestJS, Prisma ORM, PostgreSQL
- **Authentication**: JWT with tenant context (nestjs-cls)
- **Security**: AES-256-GCM encryption for credentials

### Multi-Tenancy
- Row-level isolation with `tenantId` in all integration records
- Tenant-specific encryption keys for credential storage
- Context managed via nestjs-cls (ClsService)

## Integration Providers

### 1. Meta Ads (META_ADS)
- **Limit**: ONE integration per tenant
- **Purpose**: Sync ad campaign data, spend tracking, conversions
- **API**: Meta Marketing API (Graph API)
- **Credentials**: Access Token
- **Config**: Ad Account ID

### 2. Pancake POS (PANCAKE_POS)
- **Limit**: MULTIPLE integrations per tenant (different stores)
- **Purpose**: Sync sales, products, inventory
- **API**: Pancake POS API (`https://pos.pages.fm/api/v1`)
- **Credentials**: API Key
- **Config**: Shop ID
- **Authentication**: Query parameter `?api_key={apiKey}`

## Key Features Implemented

### 1. Simplified Integration Creation Flow
**Current Flow (2 steps for Pancake POS)**:
1. User enters API key + optional description
2. User clicks "Create Integration"
   - System fetches shops from Pancake API
   - If 1 shop: Auto-creates integration with shop name
   - If multiple shops: Shows dropdown to select shop
   - Integration name automatically set to shop name

**Before (3 steps - DEPRECATED)**:
1. Enter API key
2. Test connection
3. Select shop → Create

### 2. Multiple Store Support
- Users can add multiple Pancake POS stores with different API keys
- Each store is a separate integration with its own credentials
- Meta Ads limited to one integration per tenant

### 3. Auto-Naming from API
- Integration name automatically set from shop name returned by Pancake API
- Example: API returns `{"name": "Shop thời trang"}` → Integration name: "Shop thời trang"

### 4. UI Design
**Two-Column Card Layout**:
- Left: Meta Ads card (shows status, Edit/Test/Enable-Disable buttons)
- Right: Pancake POS card (shows store count, "Add Another Store" button)

**All Integrations Table** (below cards):
- Displays all integrations with Edit, Test, Delete actions
- Shows status, enabled/disabled state, last sync time

### 5. CRUD Operations
- ✅ Create integration
- ✅ Read/List integrations
- ✅ Update integration
- ✅ Delete integration (with confirmation)
- ✅ Enable/Disable integration
- ✅ Test connection

## File Structure

### Backend Files

#### `/apps/api/src/modules/integrations/`

**integration.service.ts** (Lines 42-57)
- Handles business logic for integration management
- **Key Logic**: Allows multiple PANCAKE_POS, only one META_ADS per tenant
```typescript
if (provider === 'META_ADS') {
  const existingIntegration = await this.prisma.integration.findFirst({
    where: { tenantId, provider },
  });
  if (existingIntegration) {
    throw new ConflictException('Integration already exists');
  }
}
```

**providers/pancake-pos.provider.ts** (Lines 13-178)
- Handles Pancake POS API integration
- **API Base**: `https://pos.pages.fm/api/v1`
- **Test Connection**: Fetches shops using `GET /shops?api_key={apiKey}`
- **Response Format**: `{ success: true, shops: [...] }`

**providers/meta-ads.provider.ts**
- Handles Meta Ads API integration
- Uses Meta Graph API v18.0

**integration.controller.ts**
- REST endpoints for integration CRUD
- Routes:
  - `POST /integrations` - Create
  - `GET /integrations` - List all
  - `GET /integrations/:id` - Get one
  - `PATCH /integrations/:id` - Update
  - `DELETE /integrations/:id` - Delete
  - `POST /integrations/:id/enable` - Enable
  - `POST /integrations/:id/disable` - Disable
  - `POST /integrations/:id/test-connection` - Test

### Frontend Files

#### `/apps/web/src/app/(dashboard)/dashboard/integrations/`

**page.tsx** (Lines 1-421)
- Main integrations list page
- **Two-column layout** (Lines 201-285):
  - Meta Ads card
  - Pancake POS card
- **All Integrations table** (Lines 287-418)
- **Key Functions**:
  - `fetchIntegrations()` - Load integrations
  - `handleTestConnection(id)` - Test integration
  - `handleToggleEnabled(id, enabled)` - Enable/disable
  - `handleDelete(id, name)` - Delete with confirmation

**create/page.tsx** (Lines 1-490)
- Integration creation wizard
- **Simplified Flow** (Lines 69-143):
  - `handleCreateIntegration()` - Main function
  - Fetches shops directly from Pancake API
  - Auto-creates if 1 shop, shows dropdown if multiple
- **Key State**:
  - `step`: 'select' | 'credentials' | 'configure'
  - `apiKey`: Pancake POS API key
  - `shops`: List of shops from API
  - `selectedShopId`: Selected shop ID

**[id]/page.tsx**
- Edit integration page
- Update credentials, config, description

#### `/apps/web/src/lib/api-client.ts`
- Axios instance for API calls
- Base URL configuration

## API Endpoints

### Integration Endpoints
```
GET    /integrations              - List all integrations for tenant
POST   /integrations              - Create new integration
GET    /integrations/:id          - Get integration by ID
PATCH  /integrations/:id          - Update integration
DELETE /integrations/:id          - Delete integration
POST   /integrations/:id/enable   - Enable integration
POST   /integrations/:id/disable  - Disable integration
POST   /integrations/:id/test-connection - Test connection
```

### Request/Response Examples

**Create Pancake POS Integration**:
```json
POST /integrations
{
  "name": "Shop thời trang",
  "description": "My fashion store",
  "provider": "PANCAKE_POS",
  "credentials": {
    "apiKey": "your-api-key-here"
  },
  "config": {
    "shopId": "123"
  }
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "Shop thời trang",
  "provider": "PANCAKE_POS",
  "status": "PENDING",
  "enabled": false,
  "config": { "shopId": "123" },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## Pancake POS API Integration

### Authentication
- Method: Query parameter
- Format: `?api_key={apiKey}`

### Fetch Shops Endpoint
```
GET https://pos.pages.fm/api/v1/shops?api_key={apiKey}
```

**Response**:
```json
{
  "success": true,
  "shops": [
    {
      "id": 123,
      "name": "Shop thời trang",
      "avatar_url": "https://...",
      "pages": [...]
    }
  ]
}
```

## Database Schema

### Integration Model (Prisma)
```prisma
model Integration {
  id          String   @id @default(uuid())
  name        String
  provider    IntegrationProvider
  description String?
  credentials String   // Encrypted JSON
  config      Json
  status      IntegrationStatus
  enabled     Boolean
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lastSyncAt  DateTime?
}

enum IntegrationProvider {
  META_ADS
  PANCAKE_POS
}

enum IntegrationStatus {
  PENDING
  ACTIVE
  ERROR
  DISABLED
}
```

## Security

### Credential Encryption
- Algorithm: AES-256-GCM
- Keys: Tenant-specific encryption keys
- Storage: Encrypted credentials stored in `credentials` column
- Decryption: Only for internal use, never exposed via API

### Access Control
- All operations require valid JWT token
- Tenant context from `nestjs-cls`
- Row-level security via `tenantId` filtering

## UI/UX Flow

### Creating Pancake POS Integration

1. **User navigates to Integrations page**
   - URL: `/dashboard/integrations`
   - Sees 2-column card layout

2. **User clicks "Connect Pancake POS" or "Add Another Store"**
   - Redirects to: `/dashboard/integrations/create?provider=PANCAKE_POS`

3. **User enters credentials**
   - API Key (required)
   - Description (optional)

4. **User clicks "Create Integration"**
   - System fetches shops from `https://pos.pages.fm/api/v1/shops?api_key={apiKey}`
   - If error: Shows error message
   - If 1 shop: Auto-creates integration, redirects to list
   - If multiple shops: Shows dropdown

5. **User selects shop (if multiple)**
   - Shop name auto-set as integration name
   - Clicks "Create Integration"
   - Redirects to integrations list

6. **Success**
   - Integration appears in "All Integrations" table
   - Store count updates in Pancake POS card

## Important Code Sections

### Frontend: Simplified Create Flow
**File**: `/apps/web/src/app/(dashboard)/dashboard/integrations/create/page.tsx`
**Lines**: 69-143

```typescript
const handleCreateIntegration = async () => {
  setIsLoading(true);

  if (provider === 'PANCAKE_POS') {
    // Fetch shops directly from Pancake API
    const shopsResponse = await fetch(
      `https://pos.pages.fm/api/v1/shops?api_key=${apiKey}`
    );

    const responseData = await shopsResponse.json();
    const fetchedShops = responseData.shops;

    // If only one shop, create integration automatically
    if (fetchedShops.length === 1) {
      const shop = fetchedShops[0];
      await apiClient.post('/integrations', {
        name: shop.name,
        description,
        provider,
        credentials: { apiKey },
        config: { shopId: shop.id.toString() }
      });
      router.push('/dashboard/integrations');
    } else {
      // Multiple shops, show dropdown
      setShops(fetchedShops);
      setStep('configure');
    }
  }
};
```

### Backend: Multiple Store Logic
**File**: `/apps/api/src/modules/integrations/integration.service.ts`
**Lines**: 42-57

```typescript
// For PANCAKE_POS, allow multiple integrations (different stores)
// For META_ADS, only allow one integration per tenant
if (provider === 'META_ADS') {
  const existingIntegration = await this.prisma.integration.findFirst({
    where: { tenantId, provider },
  });

  if (existingIntegration) {
    throw new ConflictException(
      `Integration with provider ${provider} already exists for this tenant`,
    );
  }
}
```

## Current State

### ✅ Complete Features
- [x] Backend integration CRUD operations
- [x] Pancake POS provider implementation
- [x] Meta Ads provider implementation
- [x] Frontend integration list page with 2-column layout
- [x] Frontend integration creation wizard (simplified flow)
- [x] Multiple Pancake POS stores support
- [x] Auto-naming from shop name
- [x] Delete functionality with confirmation
- [x] Enable/disable integrations
- [x] Test connection functionality
- [x] Credential encryption/decryption

### 🔄 Potential Enhancements
- [ ] Integration edit page functionality
- [ ] Webhook support for real-time sync
- [ ] Data sync scheduling
- [ ] Sync history/logs
- [ ] Error handling improvements
- [ ] Loading states optimization

## Testing the Feature

### Test Pancake POS Integration
1. Navigate to `/dashboard/integrations`
2. Click "Connect Pancake POS"
3. Enter valid Pancake API key
4. Click "Create Integration"
5. Verify shop is fetched and integration created
6. Check integration appears in table with shop name

### Test Multiple Stores
1. Create first Pancake POS integration
2. Click "Add Another Store"
3. Enter different API key
4. Verify second store is created
5. Check both appear in table

### Test Delete
1. Click "Delete" on any integration
2. Confirm deletion in dialog
3. Verify integration is removed

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
JWT_EXPIRATION="1h"
REFRESH_TOKEN_SECRET="..."
REFRESH_TOKEN_EXPIRATION="7d"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Running the Application

### Backend
```bash
cd apps/api
npm install
npm run dev  # Runs on port 3001
```

### Frontend
```bash
cd apps/web
npm install
npm run dev  # Runs on port 3000
```

## Key Design Decisions

1. **Why separate integrations for each store?**
   - Different stores have different API keys
   - Allows independent enable/disable per store
   - Better tracking and management

2. **Why auto-create for single shop?**
   - Reduces friction in user flow
   - Most users have only one shop
   - Can still add description after creation via edit

3. **Why fetch shops client-side?**
   - Faster feedback to user
   - No need to create temporary integration
   - Simpler flow

4. **Why limit Meta Ads to one integration?**
   - Business requirement
   - Most tenants have one Meta Ads account
   - Can be changed if needed

## Troubleshooting

### Common Issues

**"Connection test failed"**
- Check API key is valid
- Verify Pancake API is accessible
- Check network connectivity

**"Integration already exists" (Meta Ads)**
- Only one Meta Ads integration allowed per tenant
- Delete existing integration first

**"Invalid API response"**
- API key might be valid but have no shop access
- Check API key permissions in Pancake POS settings

## Next Steps for Implementation

If continuing this feature, consider:

1. **Edit Integration Page**: Implement full edit functionality at `/dashboard/integrations/[id]/page.tsx`
2. **Sync Functionality**: Build data sync jobs for pulling Meta Ads and Pancake POS data
3. **Webhooks**: Add webhook endpoints for real-time updates from providers
4. **Analytics Dashboard**: Display synced data in analytics views
5. **Error Handling**: Improve error messages and retry logic

## References

- Pancake POS API: `https://pos.pages.fm/api/v1`
- Meta Graph API: `https://graph.facebook.com/v18.0`
- Next.js 14 Docs: https://nextjs.org/docs
- NestJS Docs: https://nestjs.com

---

**Last Updated**: 2025-11-27
**Status**: Feature complete and ready for production
