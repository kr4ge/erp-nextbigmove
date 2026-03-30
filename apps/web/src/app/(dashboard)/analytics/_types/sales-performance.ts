export type SalesPerformanceRow = {
  salesAssignee: string | null;
  shopId: string;
  orderCount: number;
  totalCod: number;
  salesCod: number;
  mktgCod: number;
  salesCodCount: number;
  mktgCodCount: number;
  upsellDelta: number;
  confirmedCount: number;
  marketingLeadCount: number;
  forUpsellCount: number;
  upsellTagCount: number;
  deliveredCount: number;
  rtsCount: number;
  pendingCount: number;
  cancelledCount: number;
  upsellCount: number;
  statusCounts: Record<string, number>;
  salesVsMktgPct: number;
  confirmationRatePct: number;
  rtsRatePct: number;
  pendingRatePct: number;
  cancellationRatePct: number;
  upsellRatePct: number;
};

export type SalesPerformanceSummaryRow = Omit<SalesPerformanceRow, 'shopId'>;
export type SalesPerformanceSortKey =
  | 'assignee'
  | 'shop'
  | 'mktg_cod'
  | 'sales_cod'
  | 'smp'
  | 'rts'
  | 'confirmation'
  | 'pending'
  | 'cancellation'
  | 'upsell_rate'
  | 'upsell_delta';

export type SalesPerformanceSummary = {
  upsell_delta: number;
  sales_cod: number;
  sales_cod_count: number;
  mktg_cod: number;
  mktg_cod_count: number;
  sales_vs_mktg_pct: number;
  confirmed_count: number;
  marketing_lead_count: number;
  confirmation_rate_pct: number;
  delivered_count: number;
  rts_count: number;
  rts_rate_pct: number;
  pending_count: number;
  cancelled_count: number;
  pending_rate_pct: number;
  cancellation_rate_pct: number;
  upsell_rate_pct: number;
  total_cod: number;
  order_count: number;
  upsell_count: number;
  for_upsell_count: number;
  upsell_tag_count: number;
};

export type SalesPerformanceOverviewResponse = {
  summary: SalesPerformanceSummary;
  prevSummary: SalesPerformanceSummary;
  rows: SalesPerformanceRow[];
  filters: {
    salesAssignees: string[];
    salesAssigneesDisplayMap?: Record<string, string>;
    includeUnassigned: boolean;
    shopDisplayMap?: Record<string, string>;
  };
  selected: {
    start_date: string;
    end_date: string;
    sales_assignees: string[];
  };
  rangeDays: number;
  lastUpdatedAt: string | null;
};

export type SunburstNode = {
  name: string;
  value: number;
  children?: SunburstNode[];
};

export type ProblematicDeliveryResponse = {
  data: SunburstNode[];
  total: number;
  trend: Array<{
    date: string;
    delivered_count: number;
    rts_count: number;
  }>;
  undeliverableAllTime?: {
    count: number;
    totalCod: number;
  };
  undeliverableTrend?: Array<{
    date: string;
    count: number;
  }>;
  onDeliveryAllTime?: {
    count: number;
    totalCod: number;
  };
  onDeliveryTrend?: Array<{
    date: string;
    count: number;
  }>;
  deliveredInRange?: {
    count: number;
    totalCod: number;
  };
  deliveredInRangeTrend?: Array<{
    date: string;
    count: number;
  }>;
  returnedInRange?: {
    count: number;
    totalCod: number;
  };
  returnedInRangeTrend?: Array<{
    date: string;
    count: number;
  }>;
  riskConfirmationRows?: Array<{
    riskTag: string;
    confirmedCount: number;
    restockingCount: number;
    waitingForPickupCount: number;
    shippedCount: number;
    deliveredCount: number;
    rtsCount: number;
  }>;
  filters: {
    shops: string[];
    shopDisplayMap?: Record<string, string>;
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
  };
  lastUpdatedAt: string | null;
};

export type SunburstHoverInfo = {
  path: string;
  orders: number;
  pct: number;
  color: string;
};

export const salesPerformanceMetricDefinitions: {
  key: keyof SalesPerformanceOverviewResponse['summary'];
  label: string;
  format: 'currency' | 'percent' | 'number';
  countKey?: keyof SalesPerformanceOverviewResponse['summary'];
}[] = [
  { key: 'mktg_cod', label: 'MKTG Cod (₱)', format: 'currency', countKey: 'mktg_cod_count' },
  { key: 'sales_cod', label: 'Sales Cod (₱)', format: 'currency', countKey: 'sales_cod_count' },
  { key: 'sales_vs_mktg_pct', label: 'SMP %', format: 'percent' },
  { key: 'rts_rate_pct', label: 'RTS Rate (%)', format: 'percent' },
  { key: 'confirmation_rate_pct', label: 'Confirmation Rate (%)', format: 'percent' },
  { key: 'pending_rate_pct', label: 'Pending Rate (%)', format: 'percent' },
  { key: 'cancellation_rate_pct', label: 'Cancellation Rate (%)', format: 'percent' },
  { key: 'upsell_rate_pct', label: 'Upsell Rate (%)', format: 'percent' },
];
