/**
 * Facebook post links are the registry's media source: a creative is registered
 * against the post it already runs as, so the link points at public Facebook
 * content rather than a Drive file.
 *
 * Accepted hosts cover the desktop, mobile, and short-link forms Meta hands out.
 */
const FACEBOOK_HOSTS = [
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
  'mbasic.facebook.com',
  'business.facebook.com',
  'fb.com',
  'www.fb.com',
  'fb.watch',
  'www.fb.watch',
];

export function isValidFacebookPostUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return false;
    return FACEBOOK_HOSTS.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
