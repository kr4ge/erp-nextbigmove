-- CreateTable
CREATE TABLE "undeliverable_remark_options" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "remark" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "undeliverable_remark_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "undeliverable_remark_options_tenantId_createdAt_idx" ON "undeliverable_remark_options"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "undeliverable_remark_options_tenantId_remark_idx" ON "undeliverable_remark_options"("tenantId", "remark");

-- AddForeignKey
ALTER TABLE "undeliverable_remark_options" ADD CONSTRAINT "undeliverable_remark_options_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
