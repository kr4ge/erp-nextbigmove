-- Per-store AI analysis context. The analysis method stays identical for every
-- creative so scores remain comparable between stores; what varies is the
-- niche pack (domain knowledge for that category) and any rules specific to
-- the store.
--
-- Additive. Existing stores default to the general-merchandise pack, which is
-- vertical-neutral, so behaviour does not change until a niche is assigned.
ALTER TABLE "creative_store_configs"
  ADD COLUMN "aiNiche" TEXT NOT NULL DEFAULT 'GENERAL_MERCHANDISE',
  ADD COLUMN "aiStoreRules" TEXT;
