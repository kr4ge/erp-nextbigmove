CREATE TABLE "pos_shop_ownerships" (
    "id" UUID NOT NULL,
    "shopId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "claimedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_shop_ownerships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_shop_ownerships_shopId_key"
ON "pos_shop_ownerships"("shopId");

CREATE UNIQUE INDEX "pos_shop_ownerships_storeId_key"
ON "pos_shop_ownerships"("storeId");

CREATE INDEX "pos_shop_ownerships_tenantId_idx"
ON "pos_shop_ownerships"("tenantId");

CREATE INDEX "pos_orders_shop_order_owner_idx"
ON "pos_orders"("shopId", "posOrderId");

ALTER TABLE "pos_shop_ownerships"
ADD CONSTRAINT "pos_shop_ownerships_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_shop_ownerships"
ADD CONSTRAINT "pos_shop_ownerships_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
