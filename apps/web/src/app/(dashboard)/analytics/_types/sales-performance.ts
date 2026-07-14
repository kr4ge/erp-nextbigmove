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

export type SalesPerformanceStoreConversionRow = {
  shopId: string;
  abandonedOrders: number;
  abandonedConvertedOrders: number;
  abandonedConvertedRevenue: number;
  abandonedConversionRatePct: number;
  abandonedDeliveredOrders: number;
  abandonedRtsOrders: number;
  abandonedDeliveryRatePct: number;
  abandonedRtsRatePct: number;
  repurchaseOrders: number;
  repurchaseConvertedOrders: number;
  repurchaseRevenue: number;
  repurchaseConversionRatePct: number;
  repurchaseDeliveredOrders: number;
  repurchaseRtsOrders: number;
  repurchaseDeliveryRatePct: number;
  repurchaseRtsRatePct: number;
};

export type SalesPerformanceStoreConversionSummary = Omit<SalesPerformanceStoreConversionRow, 'shopId'>;

export type SalesPerformanceStoreConversionResponse = {
  summary: SalesPerformanceStoreConversionSummary;
  prevSummary: SalesPerformanceStoreConversionSummary;
  rows: SalesPerformanceStoreConversionRow[];
  filters: {
    shops: string[];
    shopDisplayMap?: Record<string, string>;
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
  };
  rangeDays: number;
  lastUpdatedAt: string | null;
};

export type SalesPerformanceStoreConversionSortKey =
  | 'shop'
  | 'abandoned_revenue'
  | 'abandoned_conversion'
  | 'abandoned_delivery'
  | 'abandoned_rts'
  | 'repurchase_revenue'
  | 'repurchase_conversion'
  | 'repurchase_delivery'
  | 'repurchase_rts';

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
  repurchaseByShop?: Array<{
    shopId: string;
    deliveredOrders: number;
    deliveredAmount: number;
    rtsOrders: number;
    rtsAmount: number;
    shippedOrders: number;
    shippedAmount: number;
    totalOrders: number;
    totalAmount: number;
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
  key: keyof SalesPerformanceStoreConversionResponse['summary'];
  label: string;
  format: 'currency' | 'percent' | 'number';
  countKey?: keyof SalesPerformanceStoreConversionResponse['summary'];
}[] = [
  {
    key: 'abandonedConvertedRevenue',
    label: 'Abandoned Converted Revenue',
    format: 'currency',
    countKey: 'abandonedConvertedOrders',
  },
  {
    key: 'abandonedConversionRatePct',
    label: 'Abandoned Conversion Rate',
    format: 'percent',
    countKey: 'abandonedOrders',
  },
  {
    key: 'abandonedDeliveryRatePct',
    label: 'Abandoned Delivery Rate',
    format: 'percent',
    countKey: 'abandonedDeliveredOrders',
  },
  {
    key: 'abandonedRtsRatePct',
    label: 'Abandoned RTS Rate',
    format: 'percent',
    countKey: 'abandonedRtsOrders',
  },
  {
    key: 'repurchaseRevenue',
    label: 'Repurchase Revenue',
    format: 'currency',
    countKey: 'repurchaseConvertedOrders',
  },
  {
    key: 'repurchaseConversionRatePct',
    label: 'Repurchase Conversion Rate',
    format: 'percent',
    countKey: 'repurchaseOrders',
  },
  {
    key: 'repurchaseDeliveryRatePct',
    label: 'Repurchase Delivery Rate',
    format: 'percent',
    countKey: 'repurchaseDeliveredOrders',
  },
  {
    key: 'repurchaseRtsRatePct',
    label: 'Repurchase RTS Rate',
    format: 'percent',
    countKey: 'repurchaseRtsOrders',
  },
];
