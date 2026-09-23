-- Verdict bands for the store's cost per purchase and advertising ratio.
-- The existing cpp / arPct keep their meaning as the target; the break-even
-- is what the store cannot exceed, and scale / kill are the decision lines.

ALTER TABLE "creative_store_targets"
  ADD COLUMN "breakevenCpp" DECIMAL(12,2),
  ADD COLUMN "scaleCpp"     DECIMAL(12,2),
  ADD COLUMN "killCpp"      DECIMAL(12,2),
  ADD COLUMN "scaleArPct"   DECIMAL(6,2),
  ADD COLUMN "killArPct"    DECIMAL(6,2);
