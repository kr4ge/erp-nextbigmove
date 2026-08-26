export type OverviewLens = 'CREATIVE' | 'BUSINESS';
export type OverviewSortKey = 'creativeScore' | 'spend' | 'orders' | 'netMargin' | 'deliveryRate'
  | 'costPerOrder' | 'deliveredCostPerOrder' | 'cancellationRate' | 'rtsRate' | 'frequency'
  | 'hookRate' | 'holdRate' | 'ctr' | 'lpRate' | 'conversionRate' | 'code';

export type CreativeOverviewParams = {
  startDate: string;
  endDate: string;
  query: string;
  storeId: string;
  kind: '' | 'VIDEO' | 'STATIC';
  creatorId: string;
  lens: OverviewLens;
  page: number;
  pageSize: number;
  sortKey: OverviewSortKey;
  sortDirection: 'asc' | 'desc';
};

export type OverviewMetric = { value: number | null; numerator: number | null; denominator: number | null };

export type CreativeOverviewItem = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  store: { id: string | null; name: string };
  creator: { id: string; name: string };
  revisionState: string;
  performanceStatus: string;
  mediaUrl: string | null;
  linked: boolean;
  metaAdId: string | null;
  metaAdIds: string[];
  adCount: number;
  topAd: { adId: string; adName: string; campaignName: string; adsetId: string; spend: number } | null;
  testing: boolean;
  rank: number | null;
  medal: number | null;
  metrics: {
    creativeScore: number | null;
    winnerScore: number | null;
    decision: 'NOT_CONFIGURED';
    bottleneck: string | null;
    hookRate: number | null;
    holdRate: number | null;
    completionRate: number | null;
    ctr: number | null;
    lpRate: number | null;
    conversionRate: number | null;
    deliveryRate: number | null;
    cancellationRate: number | null;
    rtsRate: number | null;
    frequency: number | null;
    impressions: number;
    linkClicks: number;
    landingPageViews: number;
    spend?: number;
    orders: number;
    deliveredOrders: number;
    costPerOrder?: number | null;
    deliveredCostPerOrder?: number | null;
    deliveredRevenue?: number;
    netMargin?: number;
  };
};

export type ScorecardBandKey = 'hookRate' | 'holdRate' | 'completionRate' | 'ctr' | 'approvalRate';

export type ScorecardBand = {
  key: ScorecardBandKey;
  value: number | null;
  floor: number | null;
  score: number | null;
  weight: number;
};

export type CreativeScorecard = {
  scope: 'PERSONAL' | 'TEAM';
  overall: number | null;
  verdict: string | null;
  bands: ScorecardBand[];
  efficiency: {
    approvedCount: number;
    cancelledCount: number;
    outputCount: number;
    approvedPerDay: number | null;
    quotaConfigured: boolean;
    quotaAttainment: number | null;
    medianTurnaroundHours: number | null;
  };
  revisionCensus: Array<{ status: string; count: number }>;
};

export type CraftVerdict = 'SCALE' | 'REFRESH' | 'RETIRE';

export type CraftBoardRow = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  mediaUrl: string | null;
  fatiguing: boolean;
  hookRate: number | null;
  holdRate: number | null;
  completionRate: number | null;
  ctr: number | null;
  cancellationRate: number | null;
  verdict: CraftVerdict;
  reason: string;
};

export type CraftBoard = {
  videos: CraftBoardRow[];
  statics: CraftBoardRow[];
  ungradedCount: number;
};

export type OverviewFloors = {
  values: {
    hookRate: number;
    holdRate: number;
    completionRate: number;
    ctr: number;
    cancellationRate: number;
  };
  provisional: boolean;
};

/** Panels whose data source does not exist in this ERP yet report themselves unavailable instead of faking data. */
export type OverviewCapability = { available: boolean; reason?: string };

export type OverviewCapabilities = {
  callDeck: OverviewCapability;
  landingPages: OverviewCapability;
};

export type CreativeOverviewResponse = {
  selected: Omit<CreativeOverviewParams, 'page' | 'pageSize'>;
  permissions: { canReadAll: boolean; canViewMoney: boolean };
  filters: {
    stores: Array<{ value: string; label: string }>;
    defaultStoreId?: string | null;
    creators: Array<{ value: string; label: string }>;
  };
  floors: OverviewFloors;
  capabilities: OverviewCapabilities;
  kpis: Record<string, OverviewMetric>;
  scorecard: CreativeScorecard;
  craftBoard: CraftBoard;
  warnings: Array<{ code: string; severity: 'info' | 'warning'; message: string }>;
  items: CreativeOverviewItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  generatedAt: string;
};
