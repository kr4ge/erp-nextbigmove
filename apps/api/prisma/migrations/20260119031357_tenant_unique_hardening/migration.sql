/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,shopId,posOrderId]` on the table `pos_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,productId,storeId,startDate]` on the table `pos_product_cogs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,storeId,tagId]` on the table `pos_tags` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,userId,teamId]` on the table `team_memberships` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "pos_orders_shopId_posOrderId_key";

-- DropIndex
DROP INDEX "pos_product_cogs_productId_storeId_startDate_key";

-- DropIndex
DROP INDEX "pos_tags_storeId_tagId_key";

-- DropIndex
DROP INDEX "team_memberships_userId_teamId_key";

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_tenantId_shopId_posOrderId_key" ON "pos_orders"("tenantId", "shopId", "posOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_product_cogs_tenantId_productId_storeId_startDate_key" ON "pos_product_cogs"("tenantId", "productId", "storeId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "pos_tags_tenantId_storeId_tagId_key" ON "pos_tags"("tenantId", "storeId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_tenantId_userId_teamId_key" ON "team_memberships"("tenantId", "userId", "teamId");
