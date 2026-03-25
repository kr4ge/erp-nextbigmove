-- CreateTable
CREATE TABLE "pos_provinces" (
  "id" TEXT NOT NULL,
  "countryCode" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "newId" TEXT,
  "regionType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_districts" (
  "id" TEXT NOT NULL,
  "provinceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "postcode" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_communes" (
  "id" TEXT NOT NULL,
  "provinceId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "newId" TEXT,
  "postcode" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_communes_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "pos_provinces_countryCode_name_idx"
  ON "pos_provinces" ("countryCode", "name");

CREATE INDEX "pos_districts_provinceId_name_idx"
  ON "pos_districts" ("provinceId", "name");

CREATE INDEX "pos_communes_provinceId_districtId_name_idx"
  ON "pos_communes" ("provinceId", "districtId", "name");

CREATE INDEX "pos_communes_districtId_name_idx"
  ON "pos_communes" ("districtId", "name");

-- Foreign keys
ALTER TABLE "pos_districts"
  ADD CONSTRAINT "pos_districts_provinceId_fkey"
  FOREIGN KEY ("provinceId")
  REFERENCES "pos_provinces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "pos_communes"
  ADD CONSTRAINT "pos_communes_provinceId_fkey"
  FOREIGN KEY ("provinceId")
  REFERENCES "pos_provinces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "pos_communes"
  ADD CONSTRAINT "pos_communes_districtId_fkey"
  FOREIGN KEY ("districtId")
  REFERENCES "pos_districts"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
