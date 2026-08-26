-- Registry codes now carry the creative's kind in the letter: `V` for video,
-- `I` for a static image (TB-V0004 vs TB-I0005). Widening the CHECK rather
-- than replacing it keeps every code minted before the split — all of which
-- used `V`, statics included — valid forever. Those codes are printed on live
-- Meta ads; narrowing the pattern later would orphan them.
ALTER TABLE "creatives" DROP CONSTRAINT "creatives_code_check";
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_code_check"
  CHECK ("code" ~ '^[A-Z]{2,6}-[VI][0-9]{3,6}$');
