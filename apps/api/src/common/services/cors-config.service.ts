const DEV_FALLBACK_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function resolveAllowedCorsOrigins(nodeEnv = process.env.NODE_ENV): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();

  const addOrigin = (value?: string | null) => {
    if (!value) return;
    const normalized = normalizeOrigin(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    collected.push(normalized);
  };

  const addOriginList = (value?: string | null) => {
    if (!value) return;
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => addOrigin(item));
  };

  addOrigin(process.env.CORS_ORIGIN_WEB);
  addOrigin(process.env.CORS_ORIGIN_ADMIN);
  addOriginList(process.env.CORS_ORIGINS);

  if (collected.length === 0 && nodeEnv !== 'production') {
    DEV_FALLBACK_ORIGINS.forEach((origin) => addOrigin(origin));
  }

  return collected;
}

