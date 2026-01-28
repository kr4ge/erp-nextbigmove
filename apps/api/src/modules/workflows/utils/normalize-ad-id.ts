/**
 * Normalize an ad identifier from strings like:
 * - Pure numeric ad IDs
 * - UTM strings containing ad_id=...
 * - Long digit sequences embedded in text
 *
 * Mirrors the Laravel normalization logic used previously.
 */
export function normalizeAdId(raw?: string | null): string {
  const s = (raw || '').trim();
  if (s === '') return '';

  // If string is purely digits, return as-is
  if (/^\d+$/.test(s)) return s;

  // Extract the longest sequence of 8+ digits (ad ids are long numerics e.g., 238...)
  const longDigits = s.match(/\d{8,}/g);
  if (longDigits && longDigits.length > 0) {
    longDigits.sort((a, b) => b.length - a.length);
    return longDigits[0];
  }

  // Fallback: if looks like query params, pull ad_id param
  if (s.toLowerCase().includes('ad_id=')) {
    try {
      const query = new URLSearchParams(s);
      const adParam = query.get('ad_id');
      if (adParam) {
        const cleaned = adParam.replace(/\D+/g, '');
        if (cleaned) return cleaned;
      }
    } catch (err) {
      // Ignore parsing errors; fall through
    }
  }

  // Return trimmed original when unknown
  return s;
}
