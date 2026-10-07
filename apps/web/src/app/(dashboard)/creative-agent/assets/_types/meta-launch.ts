export type HandoffTag = 'APPROVE' | 'REVISE' | 'REJECT' | 'UNREVIEWED';
export type GateTag = HandoffTag;
export type DraftStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type GateDecision = 'APPROVE' | 'REVISE' | 'REJECT';
export type GateOutcome = 'PENDING' | 'ACCEPTED' | 'OVERRIDDEN';

export type HandoffRow = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  thumbnailUrl: string | null;
  thumbnailIsVideo: boolean;
  mediaUrl: string | null;
  driveUrl: string | null;
  angle: string | null;
  hookType: string | null;
  store: { id: string; name: string };
  product: { customId: string | null; name: string | null };
  creator: string;
  revisionState: string;
  performanceStatus: string;
  tag: HandoffTag;
  gate: {
    reviewId: string;
    decision: GateDecision | null;
    outcome: GateOutcome;
    confidence: number | null;
    shadow: boolean;
    completedAt: string | null;
    decisionNotes: string | null;
  } | null;
  analysis: { runId: string; completedAt: string | null } | null;
  gateInProgress: boolean;
  media: { held: boolean; capturedAt: string | null; expiresAt: string | null; releasedAt: string | null };
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
  sendable: boolean;
};

export type HandoffResponse = {
  items: HandoffRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<HandoffTag, number>;
  filters: { stores: Array<{ value: string; label: string }> };
  permissions: { canSend: boolean; canOverride: boolean; canRunGate: boolean };
};

export type HandoffParams = {
  storeId: string;
  tag: HandoffTag | '';
  sent: 'PENDING' | 'SENT' | 'ALL';
  query: string;
  page: number;
  pageSize: number;
};

export type DraftCopy = { creativeId: string; primaryText?: string | null; headline?: string | null };

export type PreflightInput = {
  storeConfigId: string;
  creativeIds: string[];
  campaignName?: string;
  dailyBudget?: number;
  startDate?: string;
  copy?: DraftCopy[];
};

export type PreflightCreative = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  adName: string;
  primaryText: string;
  headline: string | null;
  gate: { decision: GateDecision | null; outcome: GateOutcome; reviewId: string } | null;
  media: { held: boolean; expiresAt: string | null; reusable: boolean };
  blockers: string[];
};

export type PreflightResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  suggestion: { suggested: 1 | 2 | 3; reason: string };
  campaignName: string;
  adSetName: string;
  dailyBudget: number;
  currency: string | null;
  learningBudget: number | null;
  startTime: string;
  timezone: string;
  profile: {
    adAccountId: string;
    pageName: string | null;
    instagramUsername: string | null;
    pixelId: string;
    landingPageUrl: string;
  } | null;
  missingProfile: string[];
  creatives: PreflightCreative[];
};

/** The least a send needs to know about a creative. An Assets row satisfies it. */
export type SendCandidate = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  storeConfigId: string;
  productCustomId: string | null;
  productName: string | null;
};

export type OverrideTarget = {
  id: string;
  code: string;
  gate: { reviewId: string; decision: GateDecision | null } | null;
};

/** Deep link to the campaign in Ads Manager, or the account when nothing exists yet. */
export function adsManagerUrl(adAccountId: string, campaignId?: string | null): string {
  const base = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(adAccountId)}`;
  return campaignId ? `${base}&selected_campaign_ids=${encodeURIComponent(campaignId)}` : base;
}

export type DraftBatch = {
  id: string;
  status: DraftStatus;
  storeConfigId: string;
  storeName: string;
  campaignName: string;
  adSetName: string;
  dailyBudget: number;
  currency: string | null;
  startTime: string;
  metaAdAccountId: string;
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  adsManagerUrl: string;
  errorMessage: string | null;
  attempts: number;
  requestedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  drafts: Array<{
    id: string;
    status: DraftStatus;
    creativeId: string;
    code: string;
    title: string;
    kind: 'VIDEO' | 'STATIC';
    adName: string;
    metaVideoId: string | null;
    metaImageHash: string | null;
    metaAdId: string | null;
    errorMessage: string | null;
    mediaUploadedAt: string | null;
    completedAt: string | null;
  }>;
};
