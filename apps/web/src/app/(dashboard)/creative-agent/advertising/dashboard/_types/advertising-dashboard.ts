import type { CeilingInfo, PerformanceRow } from '../../performance/_types/advertising-performance';

export type DashboardParams = {
  startDate: string;
  endDate: string;
  storeId: string;
  storeIds: string[];
  accountId: string;
  creatorId: string;
  creatorIds: string[];
};

export type DashboardMetric = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  availability: 'OK' | 'NO_DATA' | 'UNAVAILABLE';
  provisional?: boolean;
  benchmark?: number | null;
};

export type DashboardAlert = {
  code: string;
  severity: 'critical' | 'warning';
  message: string;
  href?: string;
};

export type CalendarDay = {
  date: string;
  orders: number;
  spend: number;
  cpp: number | null;
  adSpendRatio: number | null;
  creativesEnrolled: number;
};

export type TrendPoint = {
  date: string;
  /** Pre-formatted in the tenant timezone server-side (e.g. "Jul 13"). */
  label: string;
  spend: number;
  grossValue: number;
  deliveredValue: number;
  orders: number;
  deliveredOrders: number;
};

export type AdvertisingDashboardResponse = {
  selected: DashboardParams;
  permissions: { canManageLinks: boolean; canReview: boolean };
  filters: {
    stores: Array<{ value: string; label: string }>;
    accounts: Array<{ value: string; label: string }>;
    creators: Array<{ value: string; label: string }>;
    /** Set when the tenant has exactly one usable store; the picker is then pinned. */
    defaultStoreId?: string | null;
  };
  alerts: DashboardAlert[];
  kpis: {
    advertising: {
      costPerClick: DashboardMetric;
      costPerOrder: DashboardMetric;
      posOrders: DashboardMetric;
      adSpendRatio: DashboardMetric;
      totalSpend: DashboardMetric;
      linkedSpendCoverage: DashboardMetric;
    };
    creative: {
      hookRate: DashboardMetric;
      holdRate: DashboardMetric;
      completionRate: DashboardMetric;
      ctr: DashboardMetric;
      cvr: DashboardMetric;
      orders: DashboardMetric;
      adSpend: DashboardMetric;
      mar: DashboardMetric;
      output: DashboardMetric;
      delivered: DashboardMetric;
      cancellationRate: DashboardMetric;
      rtsRate: DashboardMetric;
      deliveryRate: DashboardMetric;
    };
  };
  floors: {
    values: {
      hookRate: number;
      holdRate: number;
      completionRate: number;
      ctr: number;
      cancellationRate: number;
    };
    provisional: boolean;
  };
  revisionPipeline: {
    needsRevision: number;
    resolved: number;
    noRequests: number;
    requestedInPeriod: number;
    resolvedInPeriod: number;
    medianResolutionHours: number | null;
    withFeedback: number;
  };
  calendar: { month: string; monthLabel: string; days: CalendarDay[] };
  trend: TrendPoint[];
  needsAction: { suppressed: boolean; total: number; items: PerformanceRow[] };
  dataConfidence: {
    latestInsightDate: string | null;
    latestReconcileDate: string | null;
    orderAttributionCoverage: DashboardMetric;
    linkedSpendCoverage: DashboardMetric;
    missingVideoMetricsCount: number;
    withheldRateCount: number;
    verdictsSuppressed: boolean;
    posMetaPurchaseGap: { available: false; reason: string };
  };
  scope: {
    ceiling: CeilingInfo;
    benchmarks: { benchmarkCtr: number; maxCancellationRate: number; minAttributionCoverage: number; safetyMargin: number; provisional: true };
    periodNetContribution: number;
  };
  capabilities: { monthlySpendCap: { available: false; reason: string } };
  generatedAt: string;
};
