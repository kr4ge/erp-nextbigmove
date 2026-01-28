# Database Setup - COMPLETE ✅

## Migration Applied Successfully

**Migration**: `20251125134400_init`
**Status**: ✅ Applied and synced

## Database Schema Created

### Enums (PostgreSQL Types)
- ✅ `TenantStatus`: ACTIVE, SUSPENDED, TRIAL, CANCELLED
- ✅ `UserRole`: SUPER_ADMIN, ADMIN, USER, VIEWER
- ✅ `UserStatus`: ACTIVE, INACTIVE, INVITED, SUSPENDED
- ✅ `IntegrationStatus`: PENDING, ACTIVE, ERROR, DISABLED

### Tables Created

#### 1. `tenants` (Global Table - No tenant isolation)
**Purpose**: Manages organizations/companies using the platform

**Columns**:
- `id` (UUID, PK)
- `name` (TEXT) - Organization name
- `slug` (TEXT, UNIQUE) - URL-friendly identifier
- `domain` (TEXT, UNIQUE) - Custom domain (optional)
- `status` (TenantStatus) - Account status
- `settings` (JSONB) - Tenant-specific settings
- `metadata` (JSONB) - Additional metadata
- `features` (TEXT[]) - Enabled features array
- `maxUsers` (INTEGER, default: 10) - User limit
- `maxIntegrations` (INTEGER, default: 5) - Integration limit
- `encryptionKey` (TEXT) - Per-tenant encryption key
- `planType` (TEXT, default: 'trial') - Subscription plan
- `billingEmail` (TEXT) - Billing contact
- `createdAt`, `updatedAt` (TIMESTAMP)

**Indexes**:
- Unique on `slug`
- Unique on `domain`
- Index on `slug` (fast lookups)
- Index on `status` (filter active tenants)

---

#### 2. `users` (Tenant-Scoped)
**Purpose**: User accounts with RBAC

**Columns**:
- `id` (UUID, PK)
- `email` (TEXT)
- `password` (TEXT) - Hashed password
- `firstName`, `lastName`, `avatar` (TEXT, optional)
- **`tenantId` (UUID, FK)** ← Tenant isolation
- `role` (UserRole, default: USER) - RBAC role
- `permissions` (TEXT[]) - Granular permissions
- `status` (UserStatus, default: ACTIVE)
- `emailVerified` (BOOLEAN, default: false)
- `lastLoginAt` (TIMESTAMP, optional)
- `createdAt`, `updatedAt` (TIMESTAMP)

**Indexes**:
- Index on `tenantId` (tenant filtering)
- Index on `email` (login lookups)
- **Unique constraint on (`email`, `tenantId`)** - Same email across tenants OK

**Foreign Keys**:
- `tenantId` → `tenants(id)` ON DELETE CASCADE

---

#### 3. `integrations` (Tenant-Scoped)
**Purpose**: Data source integrations (POS, Meta Ads, etc.)

**Columns**:
- `id` (UUID, PK)
- `name` (TEXT) - Integration name
- `provider` (TEXT) - Provider type (e.g., "meta-ads", "pos")
- `description` (TEXT, optional)
- **`tenantId` (UUID, FK)** ← Tenant isolation
- `config` (JSONB) - Integration configuration
- `credentials` (TEXT) - **Encrypted** credentials
- `status` (IntegrationStatus, default: PENDING)
- `enabled` (BOOLEAN, default: false)
- `lastSyncAt` (TIMESTAMP, optional) - Last sync time
- `syncStatus`, `syncError` (TEXT, optional) - Sync state
- `createdAt`, `updatedAt` (TIMESTAMP)

**Indexes**:
- Index on `tenantId`
- Index on `provider` (filter by provider type)
- Composite index on (`tenantId`, `status`)

**Foreign Keys**:
- `tenantId` → `tenants(id)` ON DELETE CASCADE

---

#### 4. `analytics_events` (Tenant-Scoped)
**Purpose**: Store analytics events and metrics

**Columns**:
- `id` (UUID, PK)
- **`tenantId` (UUID, FK)** ← Tenant isolation
- `eventType` (TEXT) - Event category
- `eventName` (TEXT) - Event name
- `properties` (JSONB) - Event properties
- `source` (TEXT, optional) - Data source
- `sourceId` (TEXT, optional) - External reference
- `timestamp` (TIMESTAMP, default: now())

**Indexes**:
- Composite index on (`tenantId`, `timestamp`) - Time-series queries
- Composite index on (`tenantId`, `eventType`) - Filter by event type
- Index on `sourceId` - Trace to source

**Foreign Keys**:
- `tenantId` → `tenants(id)` ON DELETE CASCADE

---

#### 5. `audit_logs` (Tenant-Scoped)
**Purpose**: Audit trail for compliance and security

**Columns**:
- `id` (UUID, PK)
- **`tenantId` (UUID, FK)** ← Tenant isolation
- `userId` (UUID, FK, optional) - User who performed action
- `action` (TEXT) - Action performed (e.g., "user.created")
- `resource` (TEXT) - Resource type (e.g., "user")
- `resourceId` (TEXT, optional) - Resource ID
- `changes` (JSONB) - Before/after changes
- `ipAddress` (TEXT, optional) - Request IP
- `userAgent` (TEXT, optional) - Request user agent
- `createdAt` (TIMESTAMP)

**Indexes**:
- Composite index on (`tenantId`, `createdAt`) - Time-based filtering
- Index on `userId` - User activity tracking
- Index on `action` - Filter by action type
- Index on `resource` - Filter by resource type

**Foreign Keys**:
- `tenantId` → `tenants(id)` ON DELETE CASCADE
- `userId` → `users(id)` ON DELETE SET NULL (preserve logs if user deleted)

---

## Multi-Tenancy Strategy

### Row-Level Isolation
All tenant-scoped tables have:
- ✅ `tenantId` foreign key column
- ✅ Composite indexes starting with `tenantId` for performance
- ✅ CASCADE delete when tenant is removed
- ✅ Unique constraints scoped to `tenantId` where appropriate

### Data Isolation Features
- 🔒 **Physical isolation**: `tenantId` column in every tenant-scoped table
- 🔒 **Logical isolation**: Application-level filtering (Prisma extensions - Phase 2)
- 🔒 **PostgreSQL RLS**: Row-Level Security enabled (policies in Phase 2)
- 🔒 **Encryption**: Per-tenant encryption keys stored in `tenants.encryptionKey`

### Performance Optimization
- ✅ Composite indexes on `(tenantId, ...)` for all tenant-scoped tables
- ✅ Single-column indexes for lookup fields (`email`, `slug`, etc.)
- ✅ JSONB columns for flexible data storage
- ✅ Array columns for multi-value fields

---

## Database Connection

**Connection String**:
```
postgresql://erp_user:dev_password@localhost:5433/erp_analytics?schema=public
```

**Access via Docker**:
```bash
docker exec -it erp-postgres psql -U erp_user -d erp_analytics
```

**Prisma Studio** (GUI):
```bash
npm run api:studio
# Opens http://localhost:5555
```

---

## Verification

### Check Tables
```bash
docker exec erp-postgres psql -U erp_user -d erp_analytics -c "\dt"
```

**Result**:
```
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+----------
 public | analytics_events   | table | erp_user
 public | audit_logs         | table | erp_user
 public | integrations       | table | erp_user
 public | tenants            | table | erp_user
 public | users              | table | erp_user
```

### Check Indexes
```bash
docker exec erp-postgres psql -U erp_user -d erp_analytics -c "\di"
```

### Check Foreign Keys
```bash
docker exec erp-postgres psql -U erp_user -d erp_analytics -c "
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
"
```

---

## Next Steps for Phase 2

Now that the database is ready, Phase 2 will implement:

1. **Authentication Service** - Use `users` and `tenants` tables
2. **Tenant Context** - Automatic `tenantId` filtering
3. **RBAC** - Use `users.role` and `users.permissions`
4. **Audit Logging** - Write to `audit_logs` table
5. **Test Data** - Seed 2-3 test tenants with users

---

## Migration Commands

```bash
# Create a new migration
cd apps/api
npx prisma migrate dev --name <migration_name>

# Generate Prisma Client (after schema changes)
npx prisma generate

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Deploy migrations to production
npx prisma migrate deploy

# View migrations status
npx prisma migrate status
```

---

**Database Setup Status**: ✅ **COMPLETE**
**Ready for Phase 2**: ✅ **YES**

Generated: 2025-11-25
