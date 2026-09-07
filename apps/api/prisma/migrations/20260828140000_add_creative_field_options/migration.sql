-- Tenant-wide custom hook types and formats. Additive: new table only.
CREATE TYPE "CreativeOptionField" AS ENUM ('HOOK_TYPE', 'VIDEO_FORMAT', 'STATIC_FORMAT');

CREATE TABLE "creative_field_options" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL,
  "field"       "CreativeOptionField" NOT NULL,
  "value"       TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "createdById" UUID,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creative_field_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_field_options_tenantId_field_value_key" ON "creative_field_options"("tenantId", "field", "value");
CREATE INDEX "creative_field_options_tenantId_field_idx" ON "creative_field_options"("tenantId", "field");

ALTER TABLE "creative_field_options"
  ADD CONSTRAINT "creative_field_options_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
