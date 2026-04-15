ALTER TYPE "WmsInventoryMovementType" ADD VALUE 'PACK';

CREATE TYPE "WmsPackingStationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "WmsFulfillmentOrderStatus" AS ENUM (
  'PENDING',
  'WAITING_FOR_STOCK',
  'PICKING',
  'PICKED',
  'PACKING_PENDING',
  'PACKING_ASSIGNED',
  'PACKING',
  'PACKED',
  'HOLD',
  'CANCELED'
);
CREATE TYPE "WmsFulfillmentScanStage" AS ENUM ('PICKING', 'PACKING');
CREATE TYPE "WmsFulfillmentScanResult" AS ENUM ('ACCEPTED', 'REJECTED');

CREATE TABLE "wms_packing_stations" (
  "id" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "WmsPackingStationStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_packing_stations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_packing_station_users" (
  "id" UUID NOT NULL,
  "stationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_packing_station_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_fulfillment_orders" (
  "id" UUID NOT NULL,
  "fulfillmentCode" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID,
  "posOrderId" UUID NOT NULL,
  "warehouseId" UUID,
  "packingStationId" UUID,
  "pickerUserId" UUID,
  "packerUserId" UUID,
  "status" "WmsFulfillmentOrderStatus" NOT NULL DEFAULT 'PENDING',
  "trackingNumber" TEXT NOT NULL,
  "posStatus" INTEGER,
  "posStatusName" TEXT,
  "orderDateLocal" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "customerAddress" TEXT,
  "totalLines" INTEGER NOT NULL DEFAULT 0,
  "totalQuantity" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "pickedAt" TIMESTAMP(3),
  "packedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_fulfillment_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_fulfillment_order_items" (
  "id" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "sourceProductId" TEXT,
  "variationId" TEXT,
  "productName" TEXT NOT NULL,
  "variationName" TEXT,
  "displayCode" TEXT,
  "quantity" INTEGER NOT NULL,
  "pickedQuantity" INTEGER NOT NULL DEFAULT 0,
  "packedQuantity" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_fulfillment_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_fulfillment_unit_assignments" (
  "id" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "pickedByUserId" UUID,
  "packedByUserId" UUID,
  "pickedAt" TIMESTAMP(3),
  "packedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wms_fulfillment_unit_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wms_fulfillment_scan_logs" (
  "id" UUID NOT NULL,
  "fulfillmentOrderId" UUID NOT NULL,
  "orderItemId" UUID,
  "unitId" UUID,
  "stationId" UUID,
  "actorUserId" UUID,
  "stage" "WmsFulfillmentScanStage" NOT NULL,
  "result" "WmsFulfillmentScanResult" NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "scannedValue" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wms_fulfillment_scan_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wms_packing_stations_code_key"
ON "wms_packing_stations"("code");

CREATE INDEX "wms_packing_stations_warehouseId_status_name_idx"
ON "wms_packing_stations"("warehouseId", "status", "name");

CREATE UNIQUE INDEX "wms_packing_station_users_stationId_userId_key"
ON "wms_packing_station_users"("stationId", "userId");

CREATE INDEX "wms_packing_station_users_userId_idx"
ON "wms_packing_station_users"("userId");

CREATE UNIQUE INDEX "wms_fulfillment_orders_fulfillmentCode_key"
ON "wms_fulfillment_orders"("fulfillmentCode");

CREATE UNIQUE INDEX "wms_fulfillment_orders_posOrderId_key"
ON "wms_fulfillment_orders"("posOrderId");

CREATE INDEX "wms_fulfillment_orders_tenantId_status_createdAt_idx"
ON "wms_fulfillment_orders"("tenantId", "status", "createdAt");

CREATE INDEX "wms_fulfillment_orders_storeId_status_createdAt_idx"
ON "wms_fulfillment_orders"("storeId", "status", "createdAt");

CREATE INDEX "wms_fulfillment_orders_warehouseId_status_createdAt_idx"
ON "wms_fulfillment_orders"("warehouseId", "status", "createdAt");

CREATE INDEX "wms_fulfillment_orders_packingStationId_status_createdAt_idx"
ON "wms_fulfillment_orders"("packingStationId", "status", "createdAt");

CREATE INDEX "wms_fulfillment_orders_trackingNumber_idx"
ON "wms_fulfillment_orders"("trackingNumber");

CREATE UNIQUE INDEX "wms_fulfillment_order_items_fulfillmentOrderId_lineNo_key"
ON "wms_fulfillment_order_items"("fulfillmentOrderId", "lineNo");

CREATE INDEX "wms_fulfillment_order_items_variationId_idx"
ON "wms_fulfillment_order_items"("variationId");

CREATE UNIQUE INDEX "wms_fulfillment_unit_assignments_fulfillmentOrderId_unitId_key"
ON "wms_fulfillment_unit_assignments"("fulfillmentOrderId", "unitId");

CREATE INDEX "wms_fulfillment_unit_assignments_orderItemId_createdAt_idx"
ON "wms_fulfillment_unit_assignments"("orderItemId", "createdAt");

CREATE INDEX "wms_fulfillment_unit_assignments_unitId_idx"
ON "wms_fulfillment_unit_assignments"("unitId");

CREATE INDEX "wms_fulfillment_scan_logs_fulfillmentOrderId_createdAt_idx"
ON "wms_fulfillment_scan_logs"("fulfillmentOrderId", "createdAt");

CREATE INDEX "wms_fulfillment_scan_logs_stage_createdAt_idx"
ON "wms_fulfillment_scan_logs"("stage", "createdAt");

CREATE INDEX "wms_fulfillment_scan_logs_stationId_createdAt_idx"
ON "wms_fulfillment_scan_logs"("stationId", "createdAt");

ALTER TABLE "wms_packing_stations"
ADD CONSTRAINT "wms_packing_stations_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_packing_station_users"
ADD CONSTRAINT "wms_packing_station_users_stationId_fkey"
FOREIGN KEY ("stationId") REFERENCES "wms_packing_stations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_packing_station_users"
ADD CONSTRAINT "wms_packing_station_users_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_posOrderId_fkey"
FOREIGN KEY ("posOrderId") REFERENCES "pos_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "wms_warehouses"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_packingStationId_fkey"
FOREIGN KEY ("packingStationId") REFERENCES "wms_packing_stations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_pickerUserId_fkey"
FOREIGN KEY ("pickerUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_orders"
ADD CONSTRAINT "wms_fulfillment_orders_packerUserId_fkey"
FOREIGN KEY ("packerUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_order_items"
ADD CONSTRAINT "wms_fulfillment_order_items_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_unit_assignments"
ADD CONSTRAINT "wms_fulfillment_unit_assignments_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_unit_assignments"
ADD CONSTRAINT "wms_fulfillment_unit_assignments_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "wms_fulfillment_order_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_unit_assignments"
ADD CONSTRAINT "wms_fulfillment_unit_assignments_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "wms_inventory_units"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_unit_assignments"
ADD CONSTRAINT "wms_fulfillment_unit_assignments_pickedByUserId_fkey"
FOREIGN KEY ("pickedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_unit_assignments"
ADD CONSTRAINT "wms_fulfillment_unit_assignments_packedByUserId_fkey"
FOREIGN KEY ("packedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_scan_logs"
ADD CONSTRAINT "wms_fulfillment_scan_logs_fulfillmentOrderId_fkey"
FOREIGN KEY ("fulfillmentOrderId") REFERENCES "wms_fulfillment_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_scan_logs"
ADD CONSTRAINT "wms_fulfillment_scan_logs_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "wms_fulfillment_order_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_scan_logs"
ADD CONSTRAINT "wms_fulfillment_scan_logs_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "wms_inventory_units"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_scan_logs"
ADD CONSTRAINT "wms_fulfillment_scan_logs_stationId_fkey"
FOREIGN KEY ("stationId") REFERENCES "wms_packing_stations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wms_fulfillment_scan_logs"
ADD CONSTRAINT "wms_fulfillment_scan_logs_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
