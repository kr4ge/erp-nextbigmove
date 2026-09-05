export type PerformanceGroup = 'ADS' | 'CAMPAIGNS' | 'CREATIVES';
export type VerdictFilter = 'ALL' | 'NEEDS_ACTION' | 'SCALE' | 'WATCH' | 'KILL';
export type LinkFilter = 'ALL' | 'LINKED' | 'UNLINKED';
export type SortDirection = 'asc' | 'desc';

export type PerformanceSortKey =
  | 'name' | 'spend' | 'ordersToday' | 'spendToday' | 'spendYesterday' | 'orders'
  | 'cpp' | 'cpc' | 'deliveredCpp' | 'grossSales' | 'deliveredSales' | 'netContribution'
  | 'adSpendRatio' | 'trueRoas' | 'impressions' | 'linkClicks' | 'landingPageViews'
  | 'hookRate' | 'holdRate' | 'completionRate' | 'ctr' | 'cvr'
  | 'delivered' | 'cancelled' | 'rts' | 'deliveryRate' | 'cancellationRate' | 'rtsRate'
  | 'firstSpendDate' | 'lastSpendDate';

export type PerformanceParams = {
  startDate: string;
  endDate: string;
  query: string;
  creatorId: string;
  storeId: string;
  accountId: string;
  adId: string;
  campaignId: string;
  creativeId: string;
  group: PerformanceGroup;
  verdict: VerdictFilter;
  linkStatus: LinkFilter;
  hideNoOrders: boolean;
  minSpend: string;
  showInactive: boolean;
  page: number;
  pageSize: number;
  sortKey: PerformanceSortKey;
  sortDirection: SortDirection;
};

export type RowVerdict = {
  verdict: 'SCALE' | 'WATCH' | 'KILL' | null;
  decided: boolean;
  needsAction: boolean;
  suppressed: boolean;
  reason: string;
  route: 'CONFIRMATION' | 'FULFILLMENT' | null;
};

export type PerformanceRow = {
  key: string;
  group: PerformanceGroup;
  adId: string | null;
  accountId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adName: string | null;
  adCount: number | null;
  status: string | null;
  firstSpendDate: string | null;
  lastSpendDate: string | null;
  creative: {
    id: string;
    code: string | null;
    title: string | null;
    kind: string | null;
    mediaUrl: string | null;
    performanceStatus: string | null;
    storeId: string | null;
    storeName: string | null;
    creatorName: string | null;
  } | null;
  today: {
    available: boolean;
    orders: number | null;
    spend: number | null;
    cpp: number | null;
    spendYesterday: number | null;
  };
  metrics: {
    impressions: number;
    linkClicks: number;
    landingPageViews: number;
    orders: number;
    delivered: number;
    cancelled: number;
    rts: number;
    inProcess: number;
    deliveryRate: number | null;
    cancellationRate: number | null;
    rtsRate: number | null;
    spend: number;
    grossSales: number;
    deliveredSales: number;
    netContribution: number;
    cpc: number | null;
    cpp: number | null;
    deliveredCpp: number | null;
    adSpendRatio: number | null;
    trueRoas: number | null;
    hookRate: number | null;
    holdRate: number | null;
    completionRate: number | null;
    ctr: number | null;
    lpRate: number | null;
    cvr: number | null;
    avgWatchSeconds: number | null;
    retention25: number | null;
    retention50: number | null;
    retention75: number | null;
    retention95: number | null;
    retention100: number | null;
  };
  verdict: RowVerdict;
};

export type CeilingInfo = {
  marginPerDeliveredOrder: number | null;
  breakevenCpp: number | null;
  workingCeiling: number | null;
  provisional: boolean;
};

export type ScopeInfo = {
  ceiling: CeilingInfo;
  benchmarks: {
    benchmarkCtr: number;
    maxCancellationRate: number;
    minAttributionCoverage: number;
    safetyMargin: number;
    provisional: true;
  };
  attributionCoverage: number | null;
  linkedSpendCoverage: number | null;
  verdictsSuppressed: boolean;
};

export type PerformanceResponse = {
  selected: Omit<PerformanceParams, 'minSpend' | 'hideNoOrders' | 'showInactive'> & {
    minSpend: number | null;
    hideNoOrders: boolean;
    showInactive: boolean;
  };
  permissions: { canManageLinks: boolean; canManagePerformance: boolean; canReview: boolean };
  filters: {
    creators: Array<{ value: string; label: string }>;
    stores: Array<{ value: string; label: string }>;
    accounts: Array<{ value: string; label: string }>;
  };
  scope: ScopeInfo;
  items: PerformanceRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  warnings: Array<{ code: string; severity: 'info' | 'warning'; message: string }>;
  generatedAt: string;
};
