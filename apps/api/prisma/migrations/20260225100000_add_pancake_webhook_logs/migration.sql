-- CreateTable
CREATE TABLE "pancake_webhook_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "requestTenantId" TEXT,
    "requestId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PANCAKE_POS',
    "receiveHttpStatus" INTEGER,
    "receiveStatus" TEXT NOT NULL,
    "processStatus" TEXT NOT NULL,
    "relayStatus" TEXT,
    "payloadHash" TEXT,
    "payloadBytes" INTEGER,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "queueJobId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "headersSnapshot" JSONB NOT NULL DEFAULT '{}',
    "receiveDurationMs" INTEGER,
    "processingDurationMs" INTEGER,
    "totalDurationMs" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pancake_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pancake_webhook_log_orders" (
    "id" UUID NOT NULL,
    "logId" UUID NOT NULL,
    "shopId" TEXT,
    "orderId" TEXT,
    "status" INTEGER,
    "upsertStatus" TEXT NOT NULL,
    "reason" TEXT,
    "warning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pancake_webhook_log_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pancake_webhook_logs_tenantId_receivedAt_idx" ON "pancake_webhook_logs"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "pancake_webhook_logs_requestTenantId_receivedAt_idx" ON "pancake_webhook_logs"("requestTenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "pancake_webhook_logs_requestId_idx" ON "pancake_webhook_logs"("requestId");

-- CreateIndex
CREATE INDEX "pancake_webhook_logs_receiveStatus_receivedAt_idx" ON "pancake_webhook_logs"("receiveStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "pancake_webhook_logs_processStatus_receivedAt_idx" ON "pancake_webhook_logs"("processStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "pancake_webhook_log_orders_logId_idx" ON "pancake_webhook_log_orders"("logId");

-- CreateIndex
CREATE INDEX "pancake_webhook_log_orders_shopId_idx" ON "pancake_webhook_log_orders"("shopId");

-- CreateIndex
CREATE INDEX "pancake_webhook_log_orders_orderId_idx" ON "pancake_webhook_log_orders"("orderId");

-- AddForeignKey
ALTER TABLE "pancake_webhook_logs" ADD CONSTRAINT "pancake_webhook_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pancake_webhook_log_orders" ADD CONSTRAINT "pancake_webhook_log_orders_logId_fkey" FOREIGN KEY ("logId") REFERENCES "pancake_webhook_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
