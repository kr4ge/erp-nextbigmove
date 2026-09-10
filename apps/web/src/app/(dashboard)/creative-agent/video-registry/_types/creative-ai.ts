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

export type CreativeAiConfig = {
  policy: {
    defaultProvider: CreativeAiProvider;
    claudeModel: string;
    codexModel: string;
    defaultEffort: CreativeAiEffort;
    maxTurns: number;
    maxBudgetUsd: number;
    allowRunOverrides: boolean;
    updatedAt: string | null;
  };
  providers: CreativeAiProviderStatus[];
  permissions: {
    canConfigure: boolean;
    canManageConnections: boolean;
    canOverrideRuns: boolean;
  };
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

export type CreativeAiResult = {
  summary: string;
  verdict: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: Array<{
    timestampSeconds: number | null;
    observation: string;
    metricConnection: string;
    evidenceType: CreativeAiEvidenceType;
  }>;
  strengths: string[];
  risks: string[];
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    rationale: string;
    hypothesis: string;
    test: string;
  }>;
  dataQuality: string[];
};

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
  question?: string;
  provider?: CreativeAiProvider;
  model?: string;
  effort?: CreativeAiEffort;
};
