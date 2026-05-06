CREATE TYPE "WmsStaffActivityPlatform" AS ENUM (
  'WEB',
  'STOX'
);

CREATE TYPE "WmsStaffActivityOutcome" AS ENUM (
  'SUCCESS',
  'REJECTED',
  'EXCEPTION'
);

CREATE TABLE "wms_staff_activities" (
  "id" UUID NOT NULL,
  "tenantId" UUID,
  "actorId" UUID,
  "teamId" UUID,
  "platform" "WmsStaffActivityPlatform" NOT NULL DEFAULT 'WEB',
  "sessionId" TEXT,
  "deviceId" TEXT,
  "deviceName" TEXT,
  "actionType" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "taskType" TEXT,
  "taskId" TEXT,
  "storeId" UUID,
  "warehouseId" UUID,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "outcome" "WmsStaffActivityOutcome" NOT NULL DEFAULT 'SUCCESS',
  "reasonCode" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_staff_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wms_staff_activities_tenantId_createdAt_idx"
ON "wms_staff_activities"("tenantId", "createdAt");

CREATE INDEX "wms_staff_activities_actorId_createdAt_idx"
ON "wms_staff_activities"("actorId", "createdAt");

CREATE INDEX "wms_staff_activities_sessionId_idx"
ON "wms_staff_activities"("sessionId");

CREATE INDEX "wms_staff_activities_platform_createdAt_idx"
ON "wms_staff_activities"("platform", "createdAt");

CREATE INDEX "wms_staff_activities_actionType_createdAt_idx"
ON "wms_staff_activities"("actionType", "createdAt");

CREATE INDEX "wms_staff_activities_storeId_createdAt_idx"
ON "wms_staff_activities"("storeId", "createdAt");

CREATE INDEX "wms_staff_activities_warehouseId_createdAt_idx"
ON "wms_staff_activities"("warehouseId", "createdAt");

ALTER TABLE "wms_staff_activities"
ADD CONSTRAINT "wms_staff_activities_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_staff_activities"
ADD CONSTRAINT "wms_staff_activities_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
