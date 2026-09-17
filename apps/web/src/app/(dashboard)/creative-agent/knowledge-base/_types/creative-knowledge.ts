export type KnowledgeLabel = 'WINNER' | 'LOSER' | 'INCONCLUSIVE';
export type KnowledgeLabelSource = 'AUTOMATIC' | 'MANUAL';
/**
 * Whether the recorded outcome belongs to this creative alone. Revenue in the
 * ERP attributes to a Meta campaign, so a creative that shared its campaign has
 * only a partial claim on the result.
 */
export type KnowledgeAttribution = 'SOLE' | 'SHARED' | 'UNKNOWN';
export type KnowledgeReadiness = 'EMPTY' | 'BUILDING' | 'ADVISORY' | 'READY';

export type KnowledgeEntryCreative = {
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  format: string | null;
  hookType: string | null;
  angle: string | null;
  mediaUrl: string | null;
  thumbnailAssetId: string | null;
};

export type KnowledgeEntry = {
  id: string;
  creativeId: string;
  storeId: string;
  storeName: string | null;
  niche: string;
  label: KnowledgeLabel;
  labelSource: KnowledgeLabelSource;
  labelRationale: string | null;
  attribution: KnowledgeAttribution;
  digest: string | null;
  active: boolean;
  promotedAt: string;
  promotedBy: string | null;
  creative?: KnowledgeEntryCreative;
};

export type KnowledgeObservation = { at: number | null; what: string };

export type KnowledgeSection = {
  score: number | null;
  verdict: string | null;
  observations: KnowledgeObservation[];
};

/** The six-section report older analyses produced. */
export type KnowledgeStructureV1 = {
  schemaVersion: 1;
  summary: string | null;
  sections: Partial<Record<string, KnowledgeSection>>;
};

export type KnowledgeAttributes = {
  angle: string;
  hookType: string;
  format: string;
  speaker: string;
  durationBucket: string;
  offerShown: string;
  ctaType: string;
  priceVisible: boolean;
  otherNote: string | null;
};

/** The running analyst's verdict record: classification plus the lesson. */
export type KnowledgeStructureV2 = {
  schemaVersion: 2;
  verdict: string;
  verdictReason: string | null;
  confidence: string | null;
  attributes: KnowledgeAttributes;
  lesson: string;
  diagnosis: { funnelReading: string | null; creativeElement: string | null; notTheCreative: string | null };
  audienceQuality: { failed: boolean; suspectedElement: string | null };
  evidence: Array<{ metric: string; value: string; versusTarget: string }>;
  complianceFlags: string[];
};

export type KnowledgeStructure = KnowledgeStructureV1 | KnowledgeStructureV2;

export type KnowledgeEntryDetail = KnowledgeEntry & {
  structure: KnowledgeStructure | null;
  metrics: {
    spend: number;
    impressions: number;
    orders: number;
    delivered: number;
    netContribution: number | null;
    deliveredCostPerOrder: number | null;
    linkedAdCount: number;
  } | null;
};

export type KnowledgeCoverage = {
  storeId: string;
  storeName: string;
  niche: string;
  hasStoreRules: boolean;
  winners: number;
  losers: number;
  inconclusive: number;
  total: number;
  readiness: KnowledgeReadiness;
};

export type EnrollmentDecision = 'APPROVE' | 'REVISE' | 'REJECT';
export type EnrollmentReviewStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type EnrollmentReviewOutcome = 'PENDING' | 'ACCEPTED' | 'OVERRIDDEN';

export type EnrollmentReview = {
  id: string;
  creativeId: string;
  storeConfigId: string;
  status: EnrollmentReviewStatus;
  decision: EnrollmentDecision | null;
  confidence: number | null;
  rationale: Array<{ point: string; basis: string; timestampSeconds?: number | null }> | null;
  requiredChanges: Array<{ change: string; reason: string; timestampSeconds?: number | null }> | null;
  shadow: boolean;
  corpusSize: number;
  outcome: EnrollmentReviewOutcome;
  decisionNotes: string | null;
  decidedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  creative?: { code: string; title: string; kind: string };
  storeConfig?: { storeNameSnapshot: string };
  decidedBy?: { firstName: string; lastName: string } | null;
};

export type GateCalibration = {
  ruled: number;
  accepted: number;
  overridden: number;
  agreementRate: number | null;
  readyToLeaveShadow: boolean;
};
