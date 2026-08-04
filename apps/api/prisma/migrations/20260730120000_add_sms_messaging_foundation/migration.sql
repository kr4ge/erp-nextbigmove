CREATE TYPE "SmsChannelType" AS ENUM ('PHYSICAL_SIM', 'VIRTUAL_PROVIDER');
CREATE TYPE "SmsDeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'OFFLINE', 'REVOKED');
CREATE TYPE "SmsSimStatus" AS ENUM ('ACTIVE', 'OFFLINE', 'DISABLED');
CREATE TYPE "SmsMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "SmsMessageStatus" AS ENUM (
  'PENDING',
  'WAITING_FOR_DEVICE',
  'DISPATCHING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'EXPIRED',
  'RECEIVED'
);
CREATE TYPE "SmsMessageEventType" AS ENUM (
  'QUEUED',
  'WAITING_FOR_DEVICE',
  'DISPATCH_ACCEPTED',
  'SENT',
  'DELIVERED',
  'FAILED',
  'EXPIRED',
  'RECEIVED',
  'REDACTED'
);
CREATE TYPE "SmsSuppressionSource" AS ENUM ('STOP', 'MANUAL', 'IMPORTED');
CREATE TYPE "SmsOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "sms_devices" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "externalDeviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "SmsDeviceStatus" NOT NULL DEFAULT 'PENDING',
  "platform" TEXT NOT NULL DEFAULT 'ANDROID',
  "appVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "enrolledAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_sims" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "externalSimId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "phoneNumber" TEXT,
  "normalizedNumber" TEXT,
  "alias" TEXT,
  "carrier" TEXT,
  "status" "SmsSimStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_sims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_store_routes" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "simId" UUID NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_store_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_templates" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_conversations" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "simId" UUID NOT NULL,
  "storeId" UUID,
  "customerPhone" TEXT NOT NULL,
  "customerPhoneNormalized" TEXT NOT NULL,
  "customerName" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessagePreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_messages" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "direction" "SmsMessageDirection" NOT NULL,
  "status" "SmsMessageStatus" NOT NULL,
  "channelType" "SmsChannelType" NOT NULL DEFAULT 'PHYSICAL_SIM',
  "simId" UUID NOT NULL,
  "deviceId" UUID,
  "storeId" UUID,
  "posOrderId" UUID,
  "senderPhone" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "bodyEncoding" TEXT NOT NULL,
  "segmentCount" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "gatewayMessageId" TEXT,
  "externalOrderId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdById" UUID,
  "queuedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "redactedAt" TIMESTAMP(3),
  "redactedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_message_events" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "gatewayEventId" TEXT,
  "type" "SmsMessageEventType" NOT NULL,
  "status" "SmsMessageStatus",
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_message_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_conversation_reads" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_conversation_reads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_suppressions" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "phoneNormalized" TEXT NOT NULL,
  "source" "SmsSuppressionSource" NOT NULL,
  "reason" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_usage_daily" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "simId" UUID NOT NULL,
  "usageDate" DATE NOT NULL,
  "outboundMessages" INTEGER NOT NULL DEFAULT 0,
  "outboundSegments" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "receivedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_usage_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_outbox_events" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "SmsOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sms_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_devices_externalDeviceId_key" ON "sms_devices"("externalDeviceId");
CREATE INDEX "sms_devices_tenantId_status_idx" ON "sms_devices"("tenantId", "status");
CREATE INDEX "sms_devices_tenantId_lastSeenAt_idx" ON "sms_devices"("tenantId", "lastSeenAt");

CREATE UNIQUE INDEX "sms_sims_externalSimId_key" ON "sms_sims"("externalSimId");
CREATE UNIQUE INDEX "sms_sims_deviceId_subscriptionId_key" ON "sms_sims"("deviceId", "subscriptionId");
CREATE INDEX "sms_sims_tenantId_status_idx" ON "sms_sims"("tenantId", "status");
CREATE INDEX "sms_sims_tenantId_normalizedNumber_idx" ON "sms_sims"("tenantId", "normalizedNumber");

CREATE UNIQUE INDEX "sms_store_routes_tenantId_storeId_simId_key" ON "sms_store_routes"("tenantId", "storeId", "simId");
CREATE INDEX "sms_store_routes_tenantId_storeId_isActive_priority_idx" ON "sms_store_routes"("tenantId", "storeId", "isActive", "priority");
CREATE INDEX "sms_store_routes_tenantId_simId_idx" ON "sms_store_routes"("tenantId", "simId");

CREATE UNIQUE INDEX "sms_templates_tenantId_name_key" ON "sms_templates"("tenantId", "name");
CREATE INDEX "sms_templates_tenantId_isActive_idx" ON "sms_templates"("tenantId", "isActive");
CREATE INDEX "sms_templates_createdById_idx" ON "sms_templates"("createdById");

CREATE UNIQUE INDEX "sms_conversations_tenantId_simId_customerPhoneNormalized_key"
ON "sms_conversations"("tenantId", "simId", "customerPhoneNormalized");
CREATE INDEX "sms_conversations_tenantId_lastMessageAt_idx" ON "sms_conversations"("tenantId", "lastMessageAt");
CREATE INDEX "sms_conversations_tenantId_customerPhoneNormalized_idx" ON "sms_conversations"("tenantId", "customerPhoneNormalized");
CREATE INDEX "sms_conversations_tenantId_storeId_idx" ON "sms_conversations"("tenantId", "storeId");

CREATE UNIQUE INDEX "sms_messages_idempotencyKey_key" ON "sms_messages"("idempotencyKey");
CREATE UNIQUE INDEX "sms_messages_gatewayMessageId_key" ON "sms_messages"("gatewayMessageId");
CREATE INDEX "sms_messages_tenantId_conversationId_createdAt_idx" ON "sms_messages"("tenantId", "conversationId", "createdAt");
CREATE INDEX "sms_messages_tenantId_status_createdAt_idx" ON "sms_messages"("tenantId", "status", "createdAt");
CREATE INDEX "sms_messages_tenantId_storeId_createdAt_idx" ON "sms_messages"("tenantId", "storeId", "createdAt");
CREATE INDEX "sms_messages_tenantId_posOrderId_idx" ON "sms_messages"("tenantId", "posOrderId");
CREATE INDEX "sms_messages_tenantId_simId_createdAt_idx" ON "sms_messages"("tenantId", "simId", "createdAt");

CREATE UNIQUE INDEX "sms_message_events_gatewayEventId_key" ON "sms_message_events"("gatewayEventId");
CREATE INDEX "sms_message_events_tenantId_messageId_occurredAt_idx" ON "sms_message_events"("tenantId", "messageId", "occurredAt");
CREATE INDEX "sms_message_events_tenantId_type_occurredAt_idx" ON "sms_message_events"("tenantId", "type", "occurredAt");

CREATE UNIQUE INDEX "sms_conversation_reads_tenantId_conversationId_userId_key"
ON "sms_conversation_reads"("tenantId", "conversationId", "userId");
CREATE INDEX "sms_conversation_reads_tenantId_userId_lastReadAt_idx"
ON "sms_conversation_reads"("tenantId", "userId", "lastReadAt");

CREATE UNIQUE INDEX "sms_suppressions_tenantId_phoneNormalized_key"
ON "sms_suppressions"("tenantId", "phoneNormalized");
CREATE INDEX "sms_suppressions_tenantId_isActive_idx" ON "sms_suppressions"("tenantId", "isActive");

CREATE UNIQUE INDEX "sms_usage_daily_tenantId_simId_usageDate_key"
ON "sms_usage_daily"("tenantId", "simId", "usageDate");
CREATE INDEX "sms_usage_daily_tenantId_usageDate_idx" ON "sms_usage_daily"("tenantId", "usageDate");

CREATE UNIQUE INDEX "sms_outbox_events_messageId_key" ON "sms_outbox_events"("messageId");
CREATE INDEX "sms_outbox_events_status_availableAt_idx" ON "sms_outbox_events"("status", "availableAt");
CREATE INDEX "sms_outbox_events_tenantId_status_availableAt_idx"
ON "sms_outbox_events"("tenantId", "status", "availableAt");

ALTER TABLE "sms_devices"
ADD CONSTRAINT "sms_devices_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_sims"
ADD CONSTRAINT "sms_sims_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_sims"
ADD CONSTRAINT "sms_sims_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "sms_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_store_routes"
ADD CONSTRAINT "sms_store_routes_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_store_routes"
ADD CONSTRAINT "sms_store_routes_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_store_routes"
ADD CONSTRAINT "sms_store_routes_simId_fkey"
FOREIGN KEY ("simId") REFERENCES "sms_sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_templates"
ADD CONSTRAINT "sms_templates_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_templates"
ADD CONSTRAINT "sms_templates_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sms_conversations"
ADD CONSTRAINT "sms_conversations_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_conversations"
ADD CONSTRAINT "sms_conversations_simId_fkey"
FOREIGN KEY ("simId") REFERENCES "sms_sims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sms_conversations"
ADD CONSTRAINT "sms_conversations_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "sms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_simId_fkey"
FOREIGN KEY ("simId") REFERENCES "sms_sims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "sms_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_posOrderId_fkey"
FOREIGN KEY ("posOrderId") REFERENCES "pos_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_messages"
ADD CONSTRAINT "sms_messages_redactedById_fkey"
FOREIGN KEY ("redactedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sms_message_events"
ADD CONSTRAINT "sms_message_events_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_message_events"
ADD CONSTRAINT "sms_message_events_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "sms_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_conversation_reads"
ADD CONSTRAINT "sms_conversation_reads_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_conversation_reads"
ADD CONSTRAINT "sms_conversation_reads_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "sms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_conversation_reads"
ADD CONSTRAINT "sms_conversation_reads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_suppressions"
ADD CONSTRAINT "sms_suppressions_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_suppressions"
ADD CONSTRAINT "sms_suppressions_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sms_usage_daily"
ADD CONSTRAINT "sms_usage_daily_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_usage_daily"
ADD CONSTRAINT "sms_usage_daily_simId_fkey"
FOREIGN KEY ("simId") REFERENCES "sms_sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sms_outbox_events"
ADD CONSTRAINT "sms_outbox_events_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_outbox_events"
ADD CONSTRAINT "sms_outbox_events_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "sms_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
