/**
 * The paste-ready Meta ad name is `title_creator_CODE`, and auto-matching
 * reads the code from the LAST underscore-delimited segment. An underscore
 * inside the title would add a segment and silently break that match, so the
 * character is rejected at the point of entry rather than discovered later as
 * an unlinked ad.
 */
export const TITLE_UNDERSCORE_ERROR =
  'Underscores are not allowed — they separate the parts of the Meta ad name. Use spaces or hyphens instead.';

export function validateCreativeTitle(title: string): string | null {
  return title.includes('_') ? TITLE_UNDERSCORE_ERROR : null;
}
