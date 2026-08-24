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
  qcStatus: string;
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

export type CreativeOverviewResponse = {
  selected: Omit<CreativeOverviewParams, 'page' | 'pageSize'>;
  permissions: { canReadAll: boolean; canViewMoney: boolean };
  filters: {
    stores: Array<{ value: string; label: string }>;
    creators: Array<{ value: string; label: string }>;
  };
  kpis: Record<string, OverviewMetric>;
  warnings: Array<{ code: string; severity: 'info' | 'warning'; message: string }>;
  items: CreativeOverviewItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  generatedAt: string;
};
