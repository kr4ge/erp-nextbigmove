CREATE INDEX "wms_staff_activities_tenantId_resourceType_resourceId_createdAt_idx"
ON "wms_staff_activities"("tenantId", "resourceType", "resourceId", "createdAt");
