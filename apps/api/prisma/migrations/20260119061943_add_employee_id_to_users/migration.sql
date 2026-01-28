-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employeeId" TEXT;

-- CreateIndex
CREATE INDEX "users_tenantId_employeeId_idx" ON "users"("tenantId", "employeeId");
