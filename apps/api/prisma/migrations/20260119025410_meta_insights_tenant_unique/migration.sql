/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,accountId,adId,date]` on the table `meta_ad_insights` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "meta_ad_insights_accountId_adId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_insights_tenantId_accountId_adId_date_key" ON "meta_ad_insights"("tenantId", "accountId", "adId", "date");
