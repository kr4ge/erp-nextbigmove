-- CreateEnum
CREATE TYPE "NotificationSystem" AS ENUM ('ERP', 'WMS');

-- CreateEnum
CREATE TYPE "NotificationDomain" AS ENUM ('PURCHASING', 'TRANSFER', 'PICK_PACK');

-- CreateTable
CREATE TABLE "notification_states" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "system" "NotificationSystem" NOT NULL,
    "domain" "NotificationDomain" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "sourceEventType" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "context" JSONB,
    "isUnread" BOOLEAN NOT NULL DEFAULT true,
    "readAt" TIMESTAMP(3),
    "readByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_states_tenantId_system_domain_isUnread_idx" ON "notification_states"("tenantId", "system", "domain", "isUnread");

-- CreateIndex
CREATE INDEX "notification_states_tenantId_domain_entityType_entityId_idx" ON "notification_states"("tenantId", "domain", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "notification_states_tenantId_sourceEventId_idx" ON "notification_states"("tenantId", "sourceEventId");

-- CreateIndex
CREATE INDEX "notification_states_readByUserId_idx" ON "notification_states"("readByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_states_tenantId_system_domain_entityType_entit_key" ON "notification_states"("tenantId", "system", "domain", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_states" ADD CONSTRAINT "notification_states_readByUserId_fkey" FOREIGN KEY ("readByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
