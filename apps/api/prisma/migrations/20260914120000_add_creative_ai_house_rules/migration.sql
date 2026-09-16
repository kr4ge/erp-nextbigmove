-- Advertiser-managed house rules appended to every Creative AI analysis
-- prompt. Additive; a null value means the built-in default rules apply.
ALTER TABLE "creative_ai_policies" ADD COLUMN "analysisHouseRules" TEXT;
