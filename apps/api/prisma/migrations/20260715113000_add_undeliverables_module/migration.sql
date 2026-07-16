CREATE TABLE "undeliverable_store_assignments" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "undeliverable_store_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "undeliverable_order_remarks" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "storeId" UUID,
  "remark" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "undeliverable_order_remarks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "undeliverable_store_assignments_tenantId_storeId_userId_key"
ON "undeliverable_store_assignments"("tenantId", "storeId", "userId");

CREATE INDEX "undeliverable_store_assignments_tenantId_storeId_idx"
ON "undeliverable_store_assignments"("tenantId", "storeId");

CREATE INDEX "undeliverable_store_assignments_tenantId_userId_idx"
ON "undeliverable_store_assignments"("tenantId", "userId");

CREATE INDEX "undeliverable_order_remarks_tenantId_orderId_createdAt_idx"
ON "undeliverable_order_remarks"("tenantId", "orderId", "createdAt");

CREATE INDEX "undeliverable_order_remarks_tenantId_storeId_idx"
ON "undeliverable_order_remarks"("tenantId", "storeId");

ALTER TABLE "undeliverable_store_assignments"
ADD CONSTRAINT "undeliverable_store_assignments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_store_assignments"
ADD CONSTRAINT "undeliverable_store_assignments_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_store_assignments"
ADD CONSTRAINT "undeliverable_store_assignments_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_order_remarks"
ADD CONSTRAINT "undeliverable_order_remarks_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_order_remarks"
ADD CONSTRAINT "undeliverable_order_remarks_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "undeliverable_order_remarks"
ADD CONSTRAINT "undeliverable_order_remarks_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
