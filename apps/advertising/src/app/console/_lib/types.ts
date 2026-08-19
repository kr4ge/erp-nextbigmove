export type Verdict = 'SCALE' | 'WATCH' | 'KILL' | 'TOO_EARLY';

export interface AdEconomics {
  adId: string;
  adName: string | null;
  campaignName: string | null;
  marketingAssociate: string | null;
  spend: number;
  purchases: number;
  netContribution: number;
  realizedMer: number | null;
  cpp: number | null;
  deliveryRate: number | null;
  cancelRate: number | null;
  verdict: Verdict;
  reason: string;
}

export interface Benchmark {
  cpp: number;
  cpm: number;
  ctrPct: number;
  deliveryRate: number;
  cancelRate: number;
  rtsRate: number;
  targetMer: number;
}

export interface Position {
  period: { start: string; end: string };
  benchmark: Benchmark;
  benchmarkIsDefault: boolean;
  summary: {
    spend: number;
    purchases: number;
    netContribution: number;
    realizedMer: number | null;
    cpp: number | null;
    adsWithSpend: number;
    adsWithNoOrders: number;
  };
  ads: AdEconomics[];
}

export interface BenchmarkSettings {
  benchmark: Benchmark;
  isDefault: boolean;
  label: string;
  updatedAt: string | null;
}

export interface AdAccountRow {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  status: string;
  enabled: boolean | null;
  lastSyncAt: string | null;
  spend: number;
  purchases: number;
}

export interface UploadJob {
  jobId: string;
  state: string;
  progress: {
    stage: string;
    message: string;
    processedRows: number;
    totalRows: number | null;
    insightsUpserted: number;
    datesProcessed: string[];
    percent: number | null;
  };
  failedReason: string | null;
  result: {
    rowsReceived: number;
    insightsUpserted: number;
    datesProcessed: string[];
    reconcileMarketingCompleted: boolean;
  } | null;
}
