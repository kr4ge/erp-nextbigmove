-- Creative AI runs use each tenant's Claude/Codex subscription, which bills a
-- flat monthly fee. A per-run dollar cap therefore capped nothing real: it only
-- stopped analyses before they finished. Runs are now bounded by agent turns
-- and wall-clock minutes instead.
--
-- maxBudgetUsd is kept so existing runs and their settings snapshots still
-- read back correctly; nothing writes it any more.
ALTER TABLE "creative_ai_policies" ADD COLUMN "maxRunMinutes" INTEGER NOT NULL DEFAULT 15;
