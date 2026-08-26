/**
 * A registry code reads STORE-KIND+NUMBER — `TB-V0004` is Test Brand's fourth
 * creative, a video; `TB-I0005` is its fifth, a static image. The kind letter
 * is part of the code so anyone reading a Meta ad name can tell what they are
 * looking at without opening the registry.
 *
 * `V` predates the split: every creative minted before it, static ones
 * included, carries `-V`. Those codes are permanent, so the pattern accepts
 * both letters forever — narrowing it later would orphan real ads.
 */
export const CREATIVE_CODE_REGEX = /(?<![A-Za-z])([A-Z]{2,6}-[VI]\d{3,6})(?!\d)/gi;
/** Anchored form of the same shape, for validating a whole string. */
export const CREATIVE_CODE_EXACT_REGEX = /^[A-Z]{2,6}-[VI]\d{3,6}$/;
export const CREATIVE_PREFIX_REGEX = /^[A-Z]{2,6}$/;

/** VIDEO mints `V`, STATIC mints `I` — "image" reads plainer than "static". */
export function creativeKindLetter(kind: 'VIDEO' | 'STATIC'): 'V' | 'I' {
  return kind === 'VIDEO' ? 'V' : 'I';
}

export function formatCreativeCode(codePrefix: string, kind: 'VIDEO' | 'STATIC', codeNumber: number): string {
  return `${codePrefix}-${creativeKindLetter(kind)}${String(codeNumber).padStart(4, '0')}`;
}

/** Splits a code back into its parts. Returns null when the shape does not hold. */
export function parseCreativeCode(code: string): { codePrefix: string; letter: 'V' | 'I'; codeNumber: number } | null {
  const match = /^([A-Z]{2,6})-([VI])(\d{3,6})$/.exec(code.trim().toUpperCase());
  if (!match) return null;
  return { codePrefix: match[1], letter: match[2] as 'V' | 'I', codeNumber: Number(match[3]) };
}
export const CREATIVE_ALIAS_MAX_LENGTH = 255;
export const CREATIVE_CODE_MINT_RETRIES = 3;

export const CREATIVE_AGENT_PERMISSIONS = {
  READ: 'creative_agent.read',
  READ_ALL: 'creative_agent.read_all',
  ENROLL: 'creative_agent.enroll',
  EDIT: 'creative_agent.edit',
  EDIT_ALL: 'creative_agent.edit_all',
  ALIAS_MANAGE: 'creative_agent.alias.manage',
  REVIEW: 'creative_agent.review',
  PERFORMANCE_MANAGE: 'creative_agent.performance.manage',
  STORES_MANAGE: 'creative_agent.stores.manage',
} as const;

/**
 * Strategy Log types. The list is a starting vocabulary, not a closed enum —
 * the column is free text and an "Other" entry keeps whatever was typed, so a
 * move nobody anticipated does not need a migration to be recordable.
 */
export const CREATIVE_STRATEGY_TAGS = [
  { value: 'NEW_CREATIVE', label: 'New creative' },
  { value: 'ANGLE', label: 'Angle' },
  { value: 'HOOK', label: 'Hook' },
  { value: 'SCRIPT', label: 'Script' },
  { value: 'FORMAT', label: 'Format' },
  { value: 'AD_COPY', label: 'Ad copy' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'TARGETING', label: 'Targeting' },
  { value: 'OTHER', label: 'Other' },
] as const;

/**
 * Revision is a request-for-changes signal, not an approval gate: a creative
 * linked to a running Meta ad is already live. Advertising opens a request,
 * the creator resolves it, and either side can reopen.
 */
export const REVISION_TRANSITIONS: Record<string, readonly string[]> = {
  NONE: ['NEEDS_REVISION'],
  NEEDS_REVISION: ['RESOLVED'],
  RESOLVED: ['NEEDS_REVISION'],
};

export const PERFORMANCE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['LIVE', 'RETIRED'],
  LIVE: ['WINNER', 'FATIGUED', 'RETIRED'],
  WINNER: ['FATIGUED', 'RETIRED'],
  FATIGUED: ['LIVE', 'RETIRED'],
  RETIRED: [],
};
