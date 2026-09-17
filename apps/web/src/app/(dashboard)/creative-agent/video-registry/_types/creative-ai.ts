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
  /** The two analysis prompts, editable as versioned text. */
  prompt: CreativeAiPromptConfig;
  permissions: {
    canConfigure: boolean;
    canManageConnections: boolean;
    canOverrideRuns: boolean;
    canEditPrompts: boolean;
  };
};

export type CreativeAiPromptKind = 'RUNNING_ANALYST' | 'NEW_REVIEWER';

export type CreativeAiPromptVariable = { token: string; description: string; required?: boolean };

/** One analysis prompt as the settings page shows it. */
export type CreativeAiPromptSetting = {
  kind: CreativeAiPromptKind;
  label: string;
  purpose: string;
  body: string;
  isDefault: boolean;
  version: number | null;
  latestVersion: number;
  note: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  variables: CreativeAiPromptVariable[];
  usedTokens: string[];
  unknownTokens: string[];
  /** What the system appends after the text: files, vocabulary, output rule. */
  appendix: string;
  defaultBody: string;
};

export type CreativeAiPromptConfig = {
  runningAnalyst: CreativeAiPromptSetting;
  newReviewer: CreativeAiPromptSetting;
};

export type CreativeAiPromptVersion = {
  id: string;
  version: number;
  note: string | null;
  isActive: boolean;
  characters: number;
  createdAt: string;
  createdBy: string | null;
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

export type CreativeAiAttributes = {
  angle: string;
  hookType: string;
  format: string;
  speaker: string;
  durationBucket: string;
  offerShown: string;
  ctaType: string;
  priceVisible: boolean;
  otherNote?: string | null;
};

/** Prompt 1: a verdict on a creative that has run. */
export type CreativeAiResultAnalyst = {
  verdict: 'SCALE' | 'WATCH' | 'KILL';
  verdictReason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataSufficiency: { sufficient: boolean; note: string; recheckAfter?: string | null };
  evidence: Array<{ metric: string; value: string; versusTarget: string }>;
  diagnosis: { funnelReading: string; creativeElement: string; notTheCreative?: string | null };
  action: { what: string; byHowMuch?: string | null; when: string };
  attributes: CreativeAiAttributes;
  audienceQuality: { failed: boolean; suspectedElement: string | null };
  lesson: string;
  complianceFlags?: string[];
};

/** Prompt 2: a decision on a creative that has not run. */
export type CreativeAiResultReviewer = {
  decision: 'APPROVE' | 'REVISE' | 'REJECT';
  qualityScore: number;
  scoreBreakdown?: Partial<Record<'hook' | 'clarity' | 'structurePacing' | 'production' | 'cta' | 'originality', number>>;
  noveltyLabel: 'NEW_ANGLE' | 'ITERATION' | 'DUPLICATE';
  iteratesOn?: string | null;
  confidence: number;
  openingQuote?: string | null;
  attributes: CreativeAiAttributes;
  whatWorks: string[];
  whatToFix: Array<{ fix: string; why: string; timestampSeconds?: number | null; priority?: 'HIGH' | 'MEDIUM' | 'LOW' }>;
  unfixableReason?: string | null;
  audienceQualityFlags: Array<{ element: string; basis: string; timestampSeconds?: number | null }>;
  dataBasis: { corpusUsable: boolean; note: string; matchedPatterns?: string[] };
  testHypothesis?: string | null;
  checksNotPerformed?: string[];
};

export function isAnalystResult(result: unknown): result is CreativeAiResultAnalyst {
  const r = result as CreativeAiResultAnalyst | null;
  return Boolean(r && typeof r === 'object' && 'verdict' in r && 'lesson' in r && 'attributes' in r && ['SCALE', 'WATCH', 'KILL'].includes(r.verdict));
}

export function isReviewerResult(result: unknown): result is CreativeAiResultReviewer {
  const r = result as CreativeAiResultReviewer | null;
  return Boolean(r && typeof r === 'object' && 'decision' in r && 'qualityScore' in r && ['APPROVE', 'REVISE', 'REJECT'].includes(r.decision));
}

export type CreativeAiResult = (CreativeAiResultV1 | CreativeAiResultV2 | CreativeAiResultAnalyst | CreativeAiResultReviewer) & {
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
  /** Which prompt judged this run, and why. Null on runs made before the two-prompt design. */
  analysisMode?: CreativeAiPromptKind | null;
  analysisModeNote?: string | null;
  promptTemplateId?: string | null;
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
