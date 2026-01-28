/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,teamCode]` on the table `teams` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "teamCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "teams_tenantId_teamCode_key" ON "teams"("tenantId", "teamCode");
