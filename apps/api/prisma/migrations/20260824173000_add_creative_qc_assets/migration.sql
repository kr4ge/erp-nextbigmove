ALTER TABLE "creatives"
ALTER COLUMN "qcStatus" SET DEFAULT 'DRAFT'::"CreativeQcStatus";

CREATE TABLE "creative_review_comments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_review_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "creative_review_comments_tenantId_creativeId_createdAt_idx"
ON "creative_review_comments"("tenantId", "creativeId", "createdAt");

CREATE INDEX "creative_review_comments_authorId_idx"
ON "creative_review_comments"("authorId");

ALTER TABLE "creative_review_comments"
ADD CONSTRAINT "creative_review_comments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creative_review_comments"
ADD CONSTRAINT "creative_review_comments_creativeId_fkey"
FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creative_review_comments"
ADD CONSTRAINT "creative_review_comments_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "roles"
SET "name" = 'Creative',
    "description" = 'Create, submit, and revise their own creative records',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'CREATIVE_MAKER' AND "workspace" = 'ERP';

UPDATE "roles"
SET "name" = 'Advertising',
    "description" = 'Review submitted creatives, provide feedback, and approve assets for posting',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'CREATIVE_REVIEWER' AND "workspace" = 'ERP';

DELETE FROM "role_permissions" role_permission
USING "roles" role_row, "permissions" permission_row
WHERE role_permission."roleId" = role_row."id"
  AND role_permission."permissionId" = permission_row."id"
  AND role_row."key" = 'MARKETING'
  AND role_row."workspace" = 'ERP'
  AND permission_row."key" IN (
    'creative_agent.read',
    'creative_agent.enroll',
    'creative_agent.edit'
  );
