/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,date,adId]` on the table `reconcile_marketing` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "reconcile_marketing_tenantId_date_adId_key" ON "reconcile_marketing"("tenantId", "date", "adId");
