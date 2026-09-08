-- CreateEnum
CREATE TYPE "CreativeStrategySource" AS ENUM ('MANUAL', 'AUTO_ENROLMENT');

-- CreateTable
CREATE TABLE "creative_strategy_entries" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tag" TEXT NOT NULL DEFAULT 'OTHER',
    "result" TEXT,
    "resultUpdatedAt" TIMESTAMP(3),
    "source" "CreativeStrategySource" NOT NULL DEFAULT 'MANUAL',
    "creativeId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_strategy_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_strategy_entries_tenantId_date_idx" ON "creative_strategy_entries"("tenantId", "date");

-- CreateIndex
CREATE INDEX "creative_strategy_entries_tenantId_createdById_date_idx" ON "creative_strategy_entries"("tenantId", "createdById", "date");

-- CreateIndex
CREATE INDEX "creative_strategy_entries_creativeId_idx" ON "creative_strategy_entries"("creativeId");

-- AddForeignKey
ALTER TABLE "creative_strategy_entries" ADD CONSTRAINT "creative_strategy_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_strategy_entries" ADD CONSTRAINT "creative_strategy_entries_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_strategy_entries" ADD CONSTRAINT "creative_strategy_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
