-- AlterTable
ALTER TABLE "pos_orders" ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "pos_tags" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tagId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_tags_tenantId_storeId_idx" ON "pos_tags"("tenantId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_tags_storeId_tagId_key" ON "pos_tags"("storeId", "tagId");

-- AddForeignKey
ALTER TABLE "pos_tags" ADD CONSTRAINT "pos_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_tags" ADD CONSTRAINT "pos_tags_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "pos_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
