CREATE TABLE "creative_meta_ad_links" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "creativeId" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adNameSnapshot" TEXT NOT NULL,
    "source" "CreativeMetaLinkSource" NOT NULL,
    "linkedById" UUID,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_meta_ad_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creative_meta_ad_links_tenantId_accountId_adId_key"
ON "creative_meta_ad_links"("tenantId", "accountId", "adId");

CREATE INDEX "creative_meta_ad_links_tenantId_creativeId_idx"
ON "creative_meta_ad_links"("tenantId", "creativeId");

CREATE INDEX "creative_meta_ad_links_creativeId_linkedAt_idx"
ON "creative_meta_ad_links"("creativeId", "linkedAt");

ALTER TABLE "creative_meta_ad_links"
ADD CONSTRAINT "creative_meta_ad_links_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creative_meta_ad_links"
ADD CONSTRAINT "creative_meta_ad_links_creativeId_fkey"
FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "creative_meta_ad_links" (
    "id",
    "tenantId",
    "creativeId",
    "accountId",
    "adId",
    "adNameSnapshot",
    "source",
    "linkedById",
    "linkedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    "tenantId",
    "id",
    "metaAccountId",
    "metaAdId",
    COALESCE("metaAdNameSnapshot", "code"),
    COALESCE("metaLinkSource", 'MANUAL'::"CreativeMetaLinkSource"),
    "metaLinkedById",
    COALESCE("metaLinkedAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "creatives"
WHERE "metaAccountId" IS NOT NULL
  AND "metaAdId" IS NOT NULL
ON CONFLICT ("tenantId", "accountId", "adId") DO NOTHING;
