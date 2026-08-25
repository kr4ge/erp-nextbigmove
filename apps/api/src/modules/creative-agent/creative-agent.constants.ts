export const CREATIVE_CODE_REGEX = /(?<![A-Za-z])([A-Z]{2,6}-V\d{3,6})(?!\d)/gi;
export const CREATIVE_PREFIX_REGEX = /^[A-Z]{2,6}$/;
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
