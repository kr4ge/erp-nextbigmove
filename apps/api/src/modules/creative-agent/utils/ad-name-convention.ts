/**
 * The two ad-name conventions an ad may carry, told apart by SHAPE, never by
 * underscore count. Position-counting is what broke mapping in July 2026: the
 * campaign convention changed and every downstream field silently went null.
 * A creative code is unmistakable (`NRO-V0100`), so it is the anchor.
 *
 *   new:    customId_title_CODE_creator      (code mid-name, creator last)
 *   legacy: title_creator_CODE               (copy button, code last)
 *   bare:   CODE                             (whole name is the code)
 *
 * The anchor also survives underscores inside customId or creator: everything
 * before the title is customId, everything after the code is creator. Titles
 * cannot contain underscores (validated at enrollment), which is what makes
 * the segment before the code unambiguous.
 */

/** Whole-segment version of CREATIVE_CODE_REGEX — no prose, no substrings. */
const CODE_SEGMENT_REGEX = /^[A-Z]{2,6}-V\d{3,6}$/i;

export type ParsedAdName =
  | { convention: 'new'; customId: string; title: string; code: string; creator: string }
  | { convention: 'legacy-or-bare'; code: string }
  | { convention: 'unknown' };

export function isCodeSegment(segment: string): boolean {
  return CODE_SEGMENT_REGEX.test(segment.trim());
}

export function parseAdName(adName: string): ParsedAdName {
  const trimmed = adName.trim();
  if (!trimmed) return { convention: 'unknown' };

  const segments = trimmed.split('_').map((part) => part.trim());
  const codeIndex = segments.findIndex((segment) => isCodeSegment(segment));
  if (codeIndex === -1) return { convention: 'unknown' };

  const code = segments[codeIndex];

  // New convention needs a customId AND a title before the code, and a
  // creator after it. Anything else code-shaped is the legacy paste format
  // (or a bare code), which carries no item identity.
  if (codeIndex >= 2 && codeIndex < segments.length - 1) {
    return {
      convention: 'new',
      customId: segments.slice(0, codeIndex - 1).join('_'),
      title: segments[codeIndex - 1],
      code,
      creator: segments.slice(codeIndex + 1).join('_'),
    };
  }

  return { convention: 'legacy-or-bare', code };
}

/**
 * The mapping a new-convention ad declares: the advertiser chose the item at
 * enrollment, so order contents (multi-variation carts, promo bundles) never
 * change it. Legacy names return null — their mapping, if any, still comes
 * from the campaign-name parser.
 */
export function deriveMappingFromAdName(adName: string | null | undefined): string | null {
  if (!adName) return null;
  const parsed = parseAdName(adName);
  if (parsed.convention !== 'new') return null;
  const mapping = parsed.customId.trim().toLowerCase();
  return mapping || null;
}

/** The creator a new-convention ad names; null for legacy shapes. */
export function deriveAssociateFromAdName(adName: string | null | undefined): string | null {
  if (!adName) return null;
  const parsed = parseAdName(adName);
  if (parsed.convention !== 'new') return null;
  return parsed.creator.trim() || null;
}
