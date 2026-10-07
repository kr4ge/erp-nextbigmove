import type { DraftStatus, GateDecision, GateOutcome, GateTag } from './meta-launch';
import type { CreativeKind, CreativePerformanceStatus, CreativeRevisionState } from '../../video-registry/_types/video-registry';

export type CreativeAssetMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  /** Null where the source never measured it — never render that as 0%. */
  hookRate: number | null;
  holdRate: number | null;
  ctr: number | null;
};

export type CreativeAsset = {
  id: string;
  code: string;
  title: string;
  /** Pancake custom ID of the advertised item; null on pre-item creatives. */
  customId: string | null;
  kind: CreativeKind;
  mediaUrl: string | null;
  driveUrl: string | null;
  format: string | null;
  hookType: string | null;
  angle: string | null;
  script: string | null;
  notes: string | null;
  revisionState: CreativeRevisionState;
  revisionRequestedAt: string | null;
  revisionResolvedAt: string | null;
  performanceStatus: CreativePerformanceStatus;
  creator: { id: string; name: string; adName?: string; avatar: string | null };
  store: { id: string | null; configId: string; name: string };
  isOwnSubmission: boolean;
  commentCount: number;
  lastCommentAt: string | null;
  linked: boolean;
  metaAdIds: string[];
  /** The creative's own file is held in storage, until this date, for the Meta draft. */
  sourceHeld?: boolean;
  mediaExpiresAt?: string | null;
  /** At least one AI analysis has completed for this creative. */
  aiAnalyzed: boolean;
  aiAnalyzedAt: string | null;
  aiAnalysisMode: 'RUNNING_ANALYST' | 'NEW_REVIEWER' | null;
  /** What the enrollment gate said, from its latest completed review. */
  gate: {
    reviewId: string;
    decision: GateDecision | null;
    outcome: GateOutcome;
    confidence: number | null;
    shadow: boolean;
    completedAt: string | null;
    decisionNotes: string | null;
  } | null;
  /** A gate review is queued or running; the verdict updates when it lands. */
  gateInProgress: boolean;
  /** Where the latest Meta draft stands, if one was sent. */
  draft: {
    batchId: string;
    status: DraftStatus;
    campaignName: string;
    metaAdId: string | null;
    metaCampaignId: string | null;
    adAccountId: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
  /** Send to Meta is possible without a person overriding the gate first. */
  sendable: boolean;
  /** Signed URL for the cached Facebook post cover, when one was captured. */
  thumbnailUrl: string | null;
  thumbnailIsVideo: boolean;
  /** Summed over the selected date range across this creative's linked ads. */
  metrics: CreativeAssetMetrics;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreativeAssetComment = {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatar: string | null };
};

export type CreativeAssetsParams = {
  /** The window the performance figures are summed over. */
  startDate: string;
  endDate: string;
  query: string;
  /** Empty means every store the person can see. */
  storeIds: string[];
  /** Empty means every creator. */
  creatorIds: string[];
  creativeId: string;
  revisionState: '' | CreativeRevisionState;
  /** Empty or both means no filter; one state narrows. */
  linked: Array<'LINKED' | 'UNLINKED'>;
  analyzed: Array<'ANALYZED' | 'NOT_ANALYZED'>;
  /** Empty or all four means no filter. */
  gate: GateTag[];
  queue: '' | 'REVIEW';
  page: number;
  pageSize: number;
};

export type CreativeAssetsResponse = {
  permissions: { canReadAll: boolean; canSend: boolean; canRunGate: boolean; canOverride: boolean };
  selected: CreativeAssetsParams;
  filters: {
    stores: Array<{ value: string; label: string }>;
    defaultStoreId?: string | null;
    /** count = creatives that creator enrolled inside the selected date range. */
    creators: Array<{ value: string; label: string; count?: number }>;
    revisionStates: Array<{ value: CreativeRevisionState; label: string }>;
    linkStates: Array<{ value: 'LINKED' | 'UNLINKED'; label: string }>;
    analysisStates: Array<{ value: 'ANALYZED' | 'NOT_ANALYZED'; label: string }>;
    gateStates: Array<{ value: GateTag; label: string }>;
  };
  summary: Record<string, number>;
  items: CreativeAsset[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  generatedAt: string;
};

export type CreativeAssetsView = 'tiles' | 'table';
