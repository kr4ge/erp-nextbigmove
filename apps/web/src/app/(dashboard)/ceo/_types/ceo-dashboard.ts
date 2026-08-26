export type Tone = 'healthy' | 'warning' | 'critical' | 'unknown';

export type CeoDashboardParams = {
  startDate: string;
  endDate: string;
  accountId: string;
};

export type IntegrityCheck = {
  code: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type CeoTrendPoint = {
  date: string;
  /** Pre-formatted server-side in the tenant timezone. */
  label: string;
  spend: number;
  orderValue: number;
  deliveredValue: number;
  lostValue: number;
  cancelledValue: number;
  rtsValue: number;
  inTransitValue: number;
  orders: number;
  deliveredOrders: number;
  rtsOrders: number;
};

export type HeadlineKpi = {
  value: number | null;
  count?: number;
  perDay?: number;
  numerator?: number;
  denominator?: number;
  sparkKey: string;
};

export type StoryStat = {
  label: string;
  value: number | null;
  format: 'currency' | 'count' | 'percent' | 'decimal' | 'multiple';
};

export type StoryCard = {
  tone: Tone;
  hero: { label: string; value: number | null };
  stats: StoryStat[];
  /** Written server-side and changes with the tone — never re-derive it here. */
  sentence: string;
};

export type LossSegment = {
  key: string;
  label: string;
  count: number;
  share: number | null;
  value: number | null;
  note: string;
};

export type CeoDashboardResponse = {
  selected: CeoDashboardParams;
  filters: { accounts: Array<{ value: string; label: string }> };
  freshness: { ordersSyncedAt: string | null; adSpendImportedDate: string | null };
  integrity: { checks: IntegrityCheck[]; passed: boolean };
  trend: CeoTrendPoint[];
  headline: {
    orderAmount: HeadlineKpi;
    inTransitAmount: HeadlineKpi;
    deliveredAmount: HeadlineKpi;
    adSpend: HeadlineKpi;
    rtsRate: HeadlineKpi;
  };
  stock: {
    available: boolean;
    onHand: number;
    incoming: number;
    promised: number;
    inTransit: number;
    returning: number;
    sold: number;
    dispatchedAllTime: number;
    unsellable: number;
    daysOfCover: number | null;
    averageUnitsShippedPerDay: number | null;
  };
  health: { tone: Tone; message: string };
  safetyMargin: {
    headroom: number | null;
    cpp: number | null;
    breakevenCpp: number | null;
    netPerOrder: number | null;
    tone: Tone;
    markerPosition: number | null;
    fill: number | null;
  };
  stories: { acquisition: StoryCard; retention: StoryCard; finance: StoryCard };
  shippedVolume: {
    shippedOrders: number;
    shippedValue: number;
    deliveredOrders: number;
    deliveredValue: number;
    deliveredUnits: number;
    rtsOrders: number;
    rtsValue: number;
  };
  lossBar: {
    totalOrders: number;
    totalValue: number;
    inFlightOrders: number;
    segments: LossSegment[];
  };
  retention: {
    deliveredCustomers: number;
    points: Array<{ label: string; share: number | null; customers: number }>;
    gateDays: number;
  };
  firstMove: {
    leak: { title: string; detail: string };
    action: { title: string; detail: string };
  };
  breakdown: Record<string, number | null>;
  generatedAt: string;
};
