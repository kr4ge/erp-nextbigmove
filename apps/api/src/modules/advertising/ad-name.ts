/**
 * Reading the house naming convention back out of an ad name.
 *
 * Two conventions are in use and both are read, because the console should not
 * care which one an account settled on:
 *
 *   underscore   EVIL EYE_UGC_1001_ALY_001
 *   pipe         MALABO MATA l [NRO-V0052] l JOSIAH
 *
 * The second is what the ads actually run today. The separator is a lone
 * lowercase `l`, not a pipe: in Ads Manager's font the two are indistinguishable
 * and nobody proofreads an ad name. Reading it as a pipe finds nothing, which is
 * exactly what the ERP's own parser does — it splits on underscores and comes
 * back empty for every ad in the account.
 *
 * Pure functions, no database. Whatever a name does not say, this returns null
 * rather than guessing: an untagged ad and an ad tagged "unknown" are different
 * problems, and only one of them is fixable by renaming the ad.
 */

/**
 * What divides the segments.
 *
 * A lone `l` or `I` counts only when it stands alone between spaces, so
 * "Looking Young" keeps its L and "INTERVIEW" keeps its I.
 */
const SEPARATOR = /\s+[l|I|]\s+|_/;

/** The creative code as the pipe convention writes it: [NRO-V0052]. */
const BRACKETED_CODE = /\[([A-Za-z0-9][A-Za-z0-9._-]*)\]/;

export interface AdNameParts {
  /** The creative's code, when the name carries one. */
  code: string | null;
  /** Who launched it. */
  associate: string | null;
  /** The team code, which only the underscore convention carries. */
  teamCode: string | null;
}

/** Meta appends " - Copy" when an ad is duplicated. It is not a different person. */
const COPY_SUFFIX = /\s*[-–]\s*Copy(\s+\d+)?\s*$/i;

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').replace(COPY_SUFFIX, '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Split on whichever separator the name uses.
 *
 * Underscores win when present, because a name using them is following the
 * documented convention and a stray lowercase L inside a word must not split it.
 */
function segments(adName: string): string[] {
  const source = adName.includes('_') ? adName.split('_') : adName.split(SEPARATOR);
  return source.map((part) => part.trim()).filter((part) => part !== '');
}

export function parseAdName(adName: string | null | undefined): AdNameParts {
  const name = (adName ?? '').trim();
  if (!name) return { code: null, associate: null, teamCode: null };

  // A bracketed code is unambiguous wherever it sits, so it is read first.
  const bracketed = BRACKETED_CODE.exec(name);
  const parts = segments(name);

  if (name.includes('_')) {
    // EVIL EYE_UGC_1001_ALY_001 — brand, type, team, associate, number.
    return {
      code: bracketed ? bracketed[1] : clean(parts[4]),
      associate: clean(parts[3]),
      teamCode: clean(parts[2]),
    };
  }

  // MALABO MATA l [NRO-V0052] l JOSIAH — the last segment names the person.
  // A name has to yield at least three segments before anyone is named, which
  // no ordinary sentence does.
  return {
    code: bracketed ? bracketed[1] : null,
    associate: parts.length >= 3 ? clean(parts[parts.length - 1]) : null,
    teamCode: null,
  };
}

/** The code alone, for grouping ads that ran the same creative. */
export function creativeCode(adName: string | null | undefined): string | null {
  return parseAdName(adName).code;
}

/** Who launched it, for the leaderboard's "Created by". */
export function creatorFromAdName(adName: string | null | undefined): string | null {
  return parseAdName(adName).associate;
}
