const MIN_PREFIX_LENGTH = 2;
const MAX_PREFIX_LENGTH = 6;

function lettersOnly(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, '');
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function letterPair(value: number): string {
  return `${String.fromCharCode(65 + (Math.floor(value / 26) % 26))}${String.fromCharCode(65 + (value % 26))}`;
}

export function deriveCreativeStorePrefix(storeName: string): string {
  const words = storeName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  const compact = lettersOnly(storeName);
  if (!compact) return 'ST';

  const initials = words.length > 1 ? words.map((word) => word[0]).join('') : compact;
  const candidate = initials.slice(0, MAX_PREFIX_LENGTH);
  if (candidate.length >= MIN_PREFIX_LENGTH) return candidate;
  return compact.padEnd(MIN_PREFIX_LENGTH, 'X').slice(0, MAX_PREFIX_LENGTH);
}

export function deriveCreativeStorePrefixCandidate(
  storeName: string,
  storeId: string,
  collisionAttempt = 0,
): string {
  const base = deriveCreativeStorePrefix(storeName);
  if (collisionAttempt === 0) return base;
  const suffix = letterPair(stableHash(`${storeName}|${storeId}|${collisionAttempt}`));
  return `${base.slice(0, MAX_PREFIX_LENGTH - suffix.length)}${suffix}`;
}
