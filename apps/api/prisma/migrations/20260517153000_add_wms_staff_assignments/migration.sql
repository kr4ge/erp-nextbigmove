-- CreateEnum
CREATE TYPE "WmsStaffAssignmentTaskType" AS ENUM ('PICK', 'PACK');

-- CreateTable
CREATE TABLE "wms_staff_assignments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskType" "WmsStaffAssignmentTaskType" NOT NULL,
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wms_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wms_staff_assignments_userId_key" ON "wms_staff_assignments"("userId");

-- CreateIndex
CREATE INDEX "wms_staff_assignments_taskType_idx" ON "wms_staff_assignments"("taskType");

-- CreateIndex
CREATE INDEX "wms_staff_assignments_assignedById_idx" ON "wms_staff_assignments"("assignedById");

-- AddForeignKey
ALTER TABLE "wms_staff_assignments" ADD CONSTRAINT "wms_staff_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wms_staff_assignments" ADD CONSTRAINT "wms_staff_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
