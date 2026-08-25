CREATE TYPE "CreativeKind" AS ENUM ('VIDEO', 'STATIC');
CREATE TYPE "CreativeQcStatus" AS ENUM ('FOR_APPROVAL', 'FOR_REVISION', 'REVISED', 'FOR_POSTING', 'POSTED', 'CANCELLED');
CREATE TYPE "CreativePerformanceStatus" AS ENUM ('DRAFT', 'LIVE', 'WINNER', 'FATIGUED', 'RETIRED');
CREATE TYPE "CreativeStatusDimension" AS ENUM ('QC', 'PERFORMANCE');

CREATE TABLE "creative_store_configs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID,
    "storeNameSnapshot" TEXT NOT NULL,
    "shopIdSnapshot" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "creative_store_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "creative_store_configs_codePrefix_check" CHECK ("codePrefix" ~ '^[A-Z]{2,6}$')
);

CREATE TABLE "creatives" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeConfigId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "codeNumber" INTEGER NOT NULL,
    "kind" "CreativeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT,
    "hookType" TEXT,
    "script" TEXT,
    "notes" TEXT,
    "mediaUrl" TEXT,
    "createdById" UUID NOT NULL,
    "qcStatus" "CreativeQcStatus" NOT NULL DEFAULT 'FOR_APPROVAL',
    "performanceStatus" "CreativePerformanceStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "creatives_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "creatives_code_check" CHECK ("code" ~ '^[A-Z]{2,6}-V[0-9]{3,6}$'),
    CONSTRAINT "creatives_codeNumber_check" CHECK ("codeNumber" BETWEEN 1 AND 999999)
);

CREATE TABLE "creative_aliases" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creative_status_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "dimension" "CreativeStatusDimension" NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actorId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_status_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_store_configs_storeId_key" ON "creative_store_configs"("storeId");
CREATE UNIQUE INDEX "creative_store_configs_tenantId_codePrefix_key" ON "creative_store_configs"("tenantId", "codePrefix");
CREATE INDEX "creative_store_configs_tenantId_active_idx" ON "creative_store_configs"("tenantId", "active");

CREATE UNIQUE INDEX "creatives_tenantId_code_key" ON "creatives"("tenantId", "code");
CREATE UNIQUE INDEX "creatives_storeConfigId_codeNumber_key" ON "creatives"("storeConfigId", "codeNumber");
CREATE INDEX "creatives_tenantId_createdAt_idx" ON "creatives"("tenantId", "createdAt");
CREATE INDEX "creatives_tenantId_createdById_idx" ON "creatives"("tenantId", "createdById");
CREATE INDEX "creatives_tenantId_storeConfigId_idx" ON "creatives"("tenantId", "storeConfigId");
CREATE INDEX "creatives_tenantId_qcStatus_idx" ON "creatives"("tenantId", "qcStatus");
CREATE INDEX "creatives_tenantId_performanceStatus_idx" ON "creatives"("tenantId", "performanceStatus");

CREATE UNIQUE INDEX "creative_aliases_tenantId_normalizedAlias_key" ON "creative_aliases"("tenantId", "normalizedAlias");
CREATE INDEX "creative_aliases_creativeId_idx" ON "creative_aliases"("creativeId");
CREATE INDEX "creative_aliases_tenantId_createdAt_idx" ON "creative_aliases"("tenantId", "createdAt");

CREATE INDEX "creative_status_events_tenantId_creativeId_createdAt_idx" ON "creative_status_events"("tenantId", "creativeId", "createdAt");
CREATE INDEX "creative_status_events_tenantId_dimension_createdAt_idx" ON "creative_status_events"("tenantId", "dimension", "createdAt");
CREATE INDEX "meta_ad_insights_tenantId_date_idx" ON "meta_ad_insights"("tenantId", "date");

ALTER TABLE "creative_store_configs" ADD CONSTRAINT "creative_store_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_store_configs" ADD CONSTRAINT "creative_store_configs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_storeConfigId_fkey" FOREIGN KEY ("storeConfigId") REFERENCES "creative_store_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creative_aliases" ADD CONSTRAINT "creative_aliases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_aliases" ADD CONSTRAINT "creative_aliases_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_aliases" ADD CONSTRAINT "creative_aliases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "creative_status_events" ADD CONSTRAINT "creative_status_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_status_events" ADD CONSTRAINT "creative_status_events_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creative_status_events" ADD CONSTRAINT "creative_status_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'creative_agent.read', 'Read own Creative Agent registry records', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.read_all', 'Read all Creative Agent registry records in the tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.enroll', 'Enroll Creative Agent registry records', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.edit', 'Edit own Creative Agent registry records', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.edit_all', 'Edit all Creative Agent registry records in the tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.alias.manage', 'Manage Creative Agent Meta aliases', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.review', 'Review Creative Agent QC workflow', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.performance.manage', 'Manage Creative Agent performance states', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'creative_agent.stores.manage', 'Configure POS stores for Creative Agent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."key" = 'TENANT_ADMIN'
  AND role_row."workspace" = 'ERP'
  AND permission_row."key" LIKE 'creative_agent.%'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "roles" ("id", "tenantId", "key", "name", "description", "scope", "workspace", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, role_data."key", role_data."name", role_data."description", 'TENANT'::"RoleScope", 'ERP'::"RbacWorkspace", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('CREATIVE_MANAGER', 'Creative Manager', 'Manage the tenant Creative Agent registry and workflow'),
  ('CREATIVE_MAKER', 'Creative Maker', 'Enroll and manage their own Creative Agent records'),
  ('CREATIVE_REVIEWER', 'Creative Reviewer', 'Review Creative Agent records across the tenant')
) AS role_data("key", "name", "description")
WHERE NOT EXISTS (
  SELECT 1 FROM "roles" existing
  WHERE existing."tenantId" IS NULL AND existing."key" = role_data."key"
);

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" = 'CREATIVE_MANAGER'
  AND permission_row."key" LIKE 'creative_agent.%'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" = 'CREATIVE_MAKER'
  AND permission_row."key" IN ('creative_agent.read', 'creative_agent.enroll', 'creative_agent.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."tenantId" IS NULL
  AND role_row."key" = 'CREATIVE_REVIEWER'
  AND permission_row."key" IN ('creative_agent.read_all', 'creative_agent.review')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), role_row."id", permission_row."id"
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."key" = 'MARKETING'
  AND role_row."workspace" = 'ERP'
  AND permission_row."key" IN (
    'creative_agent.read',
    'creative_agent.enroll',
    'creative_agent.edit'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
