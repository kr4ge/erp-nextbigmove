-- CreateEnum
CREATE TYPE "WmsStoxAppPlatform" AS ENUM ('ANDROID');

-- CreateEnum
CREATE TYPE "WmsStoxReleaseChannel" AS ENUM ('INTERNAL');

-- CreateTable
CREATE TABLE "wms_stox_app_releases" (
    "id" UUID NOT NULL,
    "platform" "WmsStoxAppPlatform" NOT NULL DEFAULT 'ANDROID',
    "channel" "WmsStoxReleaseChannel" NOT NULL DEFAULT 'INTERNAL',
    "version" TEXT NOT NULL,
    "buildNumber" INTEGER NOT NULL,
    "releaseNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "storageProvider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" VARCHAR(64),
    "originalFileName" TEXT,
    "createdById" UUID,
    "activatedById" UUID,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_stox_app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_stox_app_releases_platform_channel_version_buildNumber_key"
ON "wms_stox_app_releases"("platform", "channel", "version", "buildNumber");

-- CreateIndex
CREATE UNIQUE INDEX "wms_stox_app_releases_bucket_objectKey_key"
ON "wms_stox_app_releases"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "wms_stox_app_releases_platform_channel_isActive_idx"
ON "wms_stox_app_releases"("platform", "channel", "isActive");

-- CreateIndex
CREATE INDEX "wms_stox_app_releases_createdById_idx"
ON "wms_stox_app_releases"("createdById");

-- CreateIndex
CREATE INDEX "wms_stox_app_releases_activatedById_idx"
ON "wms_stox_app_releases"("activatedById");

-- AddForeignKey
ALTER TABLE "wms_stox_app_releases"
ADD CONSTRAINT "wms_stox_app_releases_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_stox_app_releases"
ADD CONSTRAINT "wms_stox_app_releases_activatedById_fkey"
FOREIGN KEY ("activatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
