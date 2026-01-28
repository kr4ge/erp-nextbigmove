-- CreateTable
CREATE TABLE "pos_stores" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "integrationId" UUID,
    "name" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopAvatarUrl" TEXT,
    "apiKey" TEXT NOT NULL,
    "description" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_stores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_stores_tenantId_idx" ON "pos_stores"("tenantId");

-- CreateIndex
CREATE INDEX "pos_stores_integrationId_idx" ON "pos_stores"("integrationId");

-- AddForeignKey
ALTER TABLE "pos_stores" ADD CONSTRAINT "pos_stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_stores" ADD CONSTRAINT "pos_stores_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
