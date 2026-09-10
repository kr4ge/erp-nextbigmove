export type MetaAdIdentity = {
  accountId: string;
  adId: string;
};

export function isManualMetaAccountId(accountId: string): boolean {
  return accountId.trim().toLowerCase().startsWith('manual:');
}

/**
 * A numeric/provider account identity is authoritative over the temporary
 * `manual:` identity generated for legacy CSV uploads. For identities of the
 * same class, retain the current value so callers can apply their own date or
 * freshness ordering deterministically.
 */
export function preferCanonicalMetaAdIdentity<T extends MetaAdIdentity>(
  current: T | undefined,
  candidate: T,
): T {
  if (!current) return candidate;
  if (
    isManualMetaAccountId(current.accountId)
    && !isManualMetaAccountId(candidate.accountId)
  ) {
    return candidate;
  }
  return current;
}
