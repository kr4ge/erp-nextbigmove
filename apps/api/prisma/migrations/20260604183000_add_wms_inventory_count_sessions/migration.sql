CREATE TYPE "WmsInventoryCountSessionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'CANCELED');

CREATE TYPE "WmsInventoryCountEntryStatus" AS ENUM ('PENDING', 'COUNTED', 'MISSING', 'UNEXPECTED');

CREATE TABLE "wms_inventory_count_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "status" "WmsInventoryCountSessionStatus" NOT NULL DEFAULT 'OPEN',
    "expectedUnitCount" INTEGER NOT NULL DEFAULT 0,
    "countedUnitCount" INTEGER NOT NULL DEFAULT 0,
    "missingUnitCount" INTEGER NOT NULL DEFAULT 0,
    "unexpectedUnitCount" INTEGER NOT NULL DEFAULT 0,
    "startedById" UUID,
    "submittedById" UUID,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_inventory_count_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_inventory_count_entries" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "inventoryUnitId" UUID,
    "status" "WmsInventoryCountEntryStatus" NOT NULL DEFAULT 'PENDING',
    "unitCode" TEXT NOT NULL,
    "unitBarcode" TEXT,
    "productName" TEXT NOT NULL,
    "productCustomId" TEXT,
    "scannedCode" TEXT,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_inventory_count_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_inventory_count_entries_sessionId_unitCode_key"
ON "wms_inventory_count_entries"("sessionId", "unitCode");

CREATE INDEX "wms_inventory_count_sessions_tenantId_warehouseId_status_createdAt_idx"
ON "wms_inventory_count_sessions"("tenantId", "warehouseId", "status", "createdAt");

CREATE INDEX "wms_inventory_count_sessions_locationId_status_idx"
ON "wms_inventory_count_sessions"("locationId", "status");

CREATE INDEX "wms_inventory_count_sessions_startedById_idx"
ON "wms_inventory_count_sessions"("startedById");

CREATE INDEX "wms_inventory_count_sessions_submittedById_idx"
ON "wms_inventory_count_sessions"("submittedById");

CREATE INDEX "wms_inventory_count_entries_sessionId_status_idx"
ON "wms_inventory_count_entries"("sessionId", "status");

CREATE INDEX "wms_inventory_count_entries_inventoryUnitId_idx"
ON "wms_inventory_count_entries"("inventoryUnitId");

ALTER TABLE "wms_inventory_count_sessions"
ADD CONSTRAINT "wms_inventory_count_sessions_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_count_sessions"
ADD CONSTRAINT "wms_inventory_count_sessions_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_count_sessions"
ADD CONSTRAINT "wms_inventory_count_sessions_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "wms_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_count_sessions"
ADD CONSTRAINT "wms_inventory_count_sessions_startedById_fkey"
FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_count_sessions"
ADD CONSTRAINT "wms_inventory_count_sessions_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_count_entries"
ADD CONSTRAINT "wms_inventory_count_entries_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "wms_inventory_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_inventory_count_entries"
ADD CONSTRAINT "wms_inventory_count_entries_inventoryUnitId_fkey"
FOREIGN KEY ("inventoryUnitId") REFERENCES "wms_inventory_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
