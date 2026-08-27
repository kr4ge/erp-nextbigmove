-- The item a creative advertises, selected at enrollment. Drives the new
-- customId_title_code_creator ad-name convention.
ALTER TABLE "creatives" ADD COLUMN "posVariationId" TEXT;
ALTER TABLE "creatives" ADD COLUMN "posCustomId" TEXT;
ALTER TABLE "creatives" ADD COLUMN "posProductName" TEXT;
