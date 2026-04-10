export interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
}

export interface DashboardStats {
  integrationCount: number;
  totalUsers: number;
}

export type MarketingMonitoringStats = {
  revenue: number;
  canceled: number;
  delivered: number;
  ad_spend: number;
  aov: number;
  cancellation_pct: number;
  rts_pct: number;
  ar_pct: number;
};

export type MarketingMonitoringEnvelope = {
  current: MarketingMonitoringStats;
  previous: MarketingMonitoringStats;
};

export type MyStats = {
  ad_spend: number;
  ar: number;
  winning_creatives: number;
  creatives_created: number;
  overall_ranking: number | null;
  winning_creatives_list?: { adId: string | null; adName: string | null }[];
  monitoring?: MarketingMonitoringEnvelope;
};

export type MarketingMyStatsResponse = {
  matchedAs: string | null;
  kpis: Omit<MyStats, "winning_creatives_list" | "monitoring">;
  winning_creatives_list?: { adId: string | null; adName: string | null }[];
  monitoring?: MarketingMonitoringEnvelope;
};

export type MarketingLeaderStatsResponse = {
  team_ad_spend: number;
  team_ar: number;
  team_overall_ranking: number | null;
  monitoring?: MarketingMonitoringEnvelope;
};

export type SalesDashboardRow = {
  salesAssignee: string | null;
  shopId: string;
  orderCount: number;
  totalCod: number;
  salesCod: number;
  mktgCod: number;
  upsellDelta: number;
  confirmedCount: number;
  marketingLeadCount: number;
  deliveredCount: number;
  rtsCount: number;
  pendingCount: number;
  cancelledCount: number;
  upsellCount: number;
  salesVsMktgPct: number;
  confirmationRatePct: number;
  rtsRatePct: number;
  pendingRatePct: number;
  cancellationRatePct: number;
  upsellRatePct: number;
};

export type SalesDashboardSummary = {
  upsell_delta: number;
  sales_cod: number;
  mktg_cod: number;
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

export type SalesDashboardResponse = {
  summary: SalesDashboardSummary;
  prevSummary: SalesDashboardSummary;
  rows: SalesDashboardRow[];
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
  filters: {
    shops: string[];
    shopDisplayMap?: Record<string, string>;
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
    sales_assignee?: string | null;
  };
  lastUpdatedAt: string | null;
};

export type KpiDashboardCard = {
  metricKey: string;
  label: string;
  targetValue: number | null;
  actualValue: number;
  achievementPct: number | null;
  status: "ON_TRACK" | "AT_RISK" | "MISSED" | "NO_TARGET";
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  format: "currency" | "percent" | "number";
  startDate: string;
  endDate: string;
  dailyProgress: Array<{
    date: string;
    actualValue: number;
    achievementPct: number | null;
  }>;
};

export type MarketingKpiDashboardResponse = {
  selected: {
    startDate: string;
    endDate: string;
    teamCode: string | null;
  };
  category: "SCALING" | "TESTING" | null;
  cards: KpiDashboardCard[];
};

export type MarketingKpiTeamDashboardResponse = {
  selected: {
    startDate: string;
    endDate: string;
    teamCode: string | null;
    teamName?: string;
  };
  cards: KpiDashboardCard[];
  members: ExecutiveKpiMemberRow[];
};

export type MarketingKpiExecutiveDashboardResponse = {
  selected: {
    startDate: string;
    endDate: string;
    teamCode: string | null;
  };
  rows: ExecutiveKpiTeamRow[];
  summary: MarketingKpiExecutiveSummary;
};

export type ExecutiveKpiMemberRow = {
  userId: string;
  name: string;
  email: string;
  employeeId: string | null;
  currentCategory: "SCALING" | "TESTING" | null;
  cards: KpiDashboardCard[];
};

export type ExecutiveKpiTeamRow = {
  teamCode: string;
  teamName: string;
  cards: KpiDashboardCard[];
  members: ExecutiveKpiMemberRow[];
};

export type MarketingKpiExecutiveSummary = {
  teamCount: number;
  onTrackCount: number;
  atRiskCount: number;
  missedCount: number;
};

export type SunburstHoverInfo = {
  path: string;
  orders: number;
  pct: number;
  color: string;
};

export interface ExecutiveOverviewStats {
  revenue?: number;
  purchases?: number;
  confirmed?: number;
  ad_spend?: number;
  ar_pct?: number;
  cm_rts_forecast?: number;
}

export type SalesMetricDefinition = {
  key: keyof SalesDashboardSummary;
  label: string;
  format: "currency" | "percent" | "number";
};
