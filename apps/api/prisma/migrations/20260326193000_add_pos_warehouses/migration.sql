CREATE TABLE "pos_warehouses" (
  "id" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "customId" TEXT,
  "address" TEXT,
  "fullAddress" TEXT,
  "phoneNumber" TEXT,
  "countryCode" INTEGER,
  "provinceId" TEXT,
  "districtId" TEXT,
  "communeId" TEXT,
  "postcode" TEXT,
  "allowCreateOrder" BOOLEAN,
  "batchConfig" JSONB,
  "customBatchConfig" JSONB,
  "customShelfConfig" JSONB,
  "shelfConfig" JSONB,
  "hideConfigBatchShelf" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pos_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_warehouses_storeId_warehouseId_key"
ON "pos_warehouses"("storeId", "warehouseId");

CREATE INDEX "pos_warehouses_storeId_idx"
ON "pos_warehouses"("storeId");

ALTER TABLE "pos_warehouses"
ADD CONSTRAINT "pos_warehouses_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
