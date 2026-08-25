export type InsightVerdict = 'SCALE' | 'REFRESH' | 'WATCH' | 'KILL' | 'TESTING';

export type InsightRow = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  angle: string | null;
  hookType: string | null;
  format: string | null;
  remixOfCode: string | null;
  performanceStatus: string;
  creator: string;
  verdict: InsightVerdict;
  reason: string;
  isWinner: boolean;
  fatiguing: boolean;
  metrics: {
    spend30: number;
    orders30: number;
    arPct30: number | null;
    hookCur: number | null;
    hookPrev: number | null;
    ctrCur: number | null;
    ctrPrev: number | null;
    frequency: number | null;
  };
};

export type InsightRun = {
  id: string;
  answer: string;
  model: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type InsightQueueResponse = {
  window: {
    econStart: string;
    end: string;
    rule: { arCeiling: number; killLine: number; evidenceSpend: number; evidenceOrders: number };
  };
  counts: Record<InsightVerdict, number>;
  rows: InsightRow[];
  latestRun: InsightRun | null;
  /** True when today's one allowed analysis has already been run (Manila day). */
  diagnoseUsedToday: boolean;
  aiConfigured: boolean;
};

export type VariantBrief = {
  title: string;
  hook: string;
  angle: string;
  hookType: string;
  format: string;
  script: string;
  rationale: string;
  differsBy: string[];
};

export type VariantsResponse = {
  creative: { id: string; code: string; title: string; storeId: string | null };
  model: string;
  variants: VariantBrief[] | null;
  raw: string | null;
};
