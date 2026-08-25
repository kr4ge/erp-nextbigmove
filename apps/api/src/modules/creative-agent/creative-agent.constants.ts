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

export const QC_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['FOR_APPROVAL', 'CANCELLED'],
  FOR_APPROVAL: ['FOR_REVISION', 'FOR_POSTING', 'CANCELLED'],
  FOR_REVISION: ['REVISED', 'CANCELLED'],
  REVISED: ['FOR_REVISION', 'FOR_POSTING', 'CANCELLED'],
  FOR_POSTING: ['FOR_REVISION', 'POSTED', 'CANCELLED'],
  POSTED: [],
  CANCELLED: [],
};

export const PERFORMANCE_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['LIVE', 'RETIRED'],
  LIVE: ['WINNER', 'FATIGUED', 'RETIRED'],
  WINNER: ['FATIGUED', 'RETIRED'],
  FATIGUED: ['LIVE', 'RETIRED'],
  RETIRED: [],
};
