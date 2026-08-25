export function creativeQueryHref(path: "/assets" | "/video-registry", code: string): string {
  return `${path}?query=${encodeURIComponent(code)}`;
}
