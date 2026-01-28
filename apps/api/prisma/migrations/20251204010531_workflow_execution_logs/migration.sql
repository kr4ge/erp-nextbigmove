-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" UUID NOT NULL,
    "executionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_execution_logs_executionId_createdAt_idx" ON "workflow_execution_logs"("executionId", "createdAt");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_tenantId_createdAt_idx" ON "workflow_execution_logs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
