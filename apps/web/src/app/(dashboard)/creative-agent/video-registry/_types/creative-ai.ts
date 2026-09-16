export type CreativeAiRunStatus =
  | 'QUEUED'
  | 'PREPROCESSING'
  | 'CONTEXT_BUILDING'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type CreativeAiEvidenceType = 'OBSERVED' | 'MEASURED' | 'HYPOTHESIS';
export type CreativeAiProvider = 'CLAUDE' | 'CODEX';
export type CreativeAiEffort = 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH' | 'MAX';

export type CreativeAiProviderStatus = {
  provider: CreativeAiProvider;
  available: boolean;
  connected: boolean;
  authMethod: string | null;
  accountLabel: string | null;
  planType: string | null;
  message: string;
  models: Array<{
    id: string;
    label: string;
    supportedEfforts: CreativeAiEffort[];
    defaultEffort: CreativeAiEffort;
  }>;
  usage?: unknown;
};

export type CreativeLens = 'DRAFT' | 'LIVE' | 'WINNER' | 'FATIGUED' | 'RETIRED';

export type CreativeAiConfig = {
  policy: {
    defaultProvider: CreativeAiProvider;
    claudeModel: string;
    codexModel: string;
    defaultEffort: CreativeAiEffort;
    maxTurns: number;
    maxRunMinutes: number;
    allowRunOverrides: boolean;
    updatedAt: string | null;
  };
  providers: CreativeAiProviderStatus[];
  /** The fixed analysis prompt's editable parts: workspace rules, the lens per
   *  performance status, the niche packs, and each store's assigned pack. */
  prompt: {
    houseRules: string | null;
    defaultHouseRules: string;
    lenses: Record<CreativeLens, string>;
    niches: CreativeAiNicheOption[];
    stores: CreativeAiStoreContext[];
  };
  permissions: {
    canConfigure: boolean;
    canManageConnections: boolean;
    canOverrideRuns: boolean;
    canEditHouseRules: boolean;
  };
};

export type CreativeAiNicheOption = {
  key: string;
  label: string;
  summary: string;
  whatMatters: string;
  lookFor: string[];
  complianceWatch: string[];
};

export type CreativeAiStoreContext = {
  id: string;
  name: string;
  codePrefix: string;
  niche: string;
  storeRules: string | null;
};

export type CreativeAiHouseRules = {
  houseRules: string | null;
  defaultHouseRules: string;
};

export type UpdateCreativeAiConfigInput = Omit<CreativeAiConfig['policy'], 'updatedAt'>;

export type CreativeAiProviderLogin = {
  loginId: string | null;
  status: 'CONNECTED' | 'WAITING' | 'FAILED';
  verificationUrl?: string;
  userCode?: string;
  expiresAt?: string;
  message: string;
};

/**
 * The AI workspace only needs the registry identity shown in its header.
 * Keeping this contract small lets Creative open it from Video Registry and
 * Advertising open the same tenant-scoped analysis from Assets.
 */
export type CreativeAiTarget = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
};

export type CreativeAiFinding = {
  timestampSeconds: number | null;
  observation: string;
  metricConnection: string;
  evidenceType: CreativeAiEvidenceType;
};

export type CreativeAiRecommendation = {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  rationale: string;
  hypothesis: string;
  test: string;
};

/** Flat result produced by prompt version 1. Kept so older runs still render. */
export type CreativeAiResultV1 = {
  version?: undefined;
  summary: string;
  verdict: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: CreativeAiFinding[];
  strengths: string[];
  risks: string[];
  recommendations: CreativeAiRecommendation[];
  dataQuality: string[];
};

export const CREATIVE_AI_SECTION_KEYS = [
  'hook',
  'storyPacing',
  'messageOffer',
  'productProof',
  'callToAction',
  'performance',
] as const;

export type CreativeAiSectionKey = (typeof CREATIVE_AI_SECTION_KEYS)[number];

export type CreativeAiSection = {
  score: number;
  verdict: string;
  findings: CreativeAiFinding[];
  recommendations: CreativeAiRecommendation[];
};

/** Sectioned result produced by prompt version 2: one entry per analysis category. */
export type CreativeAiResultV2 = {
  version: 2;
  overview: {
    verdict: string;
    summary: string;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    topActions: Array<CreativeAiRecommendation & { category: CreativeAiSectionKey }>;
    complianceFlags: string[];
    dataQuality: string[];
  };
  sections: Record<CreativeAiSectionKey, CreativeAiSection>;
};

export type CreativeAiResult = (CreativeAiResultV1 | CreativeAiResultV2) & {
  /** Run metadata written by the worker next to the model output. */
  _run?: {
    provider?: CreativeAiProvider;
    model?: string;
    effort?: CreativeAiEffort;
    promptVersion?: number;
    lens?: CreativeLens;
    totalCostUsd?: number | null;
  };
};

export function isSectionedResult(result: CreativeAiResult | null | undefined): result is CreativeAiResultV2 & { _run?: CreativeAiResult['_run'] } {
  return Boolean(result && (result as CreativeAiResultV2).version === 2 && (result as CreativeAiResultV2).sections);
}

export type CreativeAiRun = {
  id: string;
  status: CreativeAiRunStatus;
  progress: number;
  stage: string;
  creative: {
    id: string;
    code: string;
    title: string;
    kind: 'VIDEO' | 'STATIC';
    creator: { id: string; name: string };
    store: { id: string; name: string };
  };
  requestedBy: { id: string; name: string };
  source: {
    type: 'LOCAL_UPLOAD' | 'GOOGLE_DRIVE';
    fileName: string | null;
    contentType: string | null;
    byteSize: number | null;
  };
  question: string | null;
  ai?: { provider: CreativeAiProvider; model: string; effort: CreativeAiEffort };
  dateRange: { startDate: string; endDate: string };
  result: CreativeAiResult | null;
  responseText: string | null;
  warnings: string[];
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreativeAiRunsResponse = {
  items: CreativeAiRun[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type StartCreativeAiRunInput = {
  creativeId: string;
  video: File;
  startDate: string;
  endDate: string;
  provider?: CreativeAiProvider;
  model?: string;
  effort?: CreativeAiEffort;
};
