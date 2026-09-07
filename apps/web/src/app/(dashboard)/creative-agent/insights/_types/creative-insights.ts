export type SuggestionUrgency = 'REFRESH_NOW' | 'MORE_VARIATIONS';
export type OtherStatus = 'GATHERING_DATA' | 'NO_SIGNAL';

export type InsightMetrics = {
  spend30: number;
  orders30: number;
  arPct30: number | null;
  hookCur: number | null;
  hookPrev: number | null;
  ctrCur: number | null;
  ctrPrev: number | null;
  frequency: number | null;
};

/** A creative worth making fresh versions of, and why. */
export type InsightSuggestion = {
  id: string;
  code: string;
  title: string;
  kind: 'VIDEO' | 'STATIC';
  angle: string | null;
  hookType: string | null;
  format: string | null;
  remixOfCode: string | null;
  creator: string;
  isWinner: boolean;
  fatiguing: boolean;
  urgency: SuggestionUrgency;
  reason: string;
  metrics: InsightMetrics;
};

/** A creative not (yet) worth refreshing, with a neutral note — no verdicts here. */
export type InsightOther = {
  id: string;
  code: string;
  title: string;
  status: OtherStatus;
  note: string;
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
  suggestions: InsightSuggestion[];
  others: InsightOther[];
  latestRun: InsightRun | null;
  /** True when today's one allowed analysis has already been run (Manila day, per user). */
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
  creative: { id: string; code: string; title: string; storeId: string | null; variationId: string | null };
  model: string;
  variants: VariantBrief[] | null;
  raw: string | null;
};
