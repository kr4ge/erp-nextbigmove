import { CreativeKind } from '@prisma/client';

/**
 * Shared creative metric math. Every panel of the creative dashboard must go
 * through these helpers so a formula is defined exactly once.
 *
 * Conventions:
 * - Rates are fractions in [0, 1]; the UI formats them as percentages.
 * - A zero denominator returns null — never 0.
 * - An impossible rate (> 1.0) is withheld as null; callers can detect it via
 *   `isImpossibleRate` and surface a data warning instead of the broken figure.
 */

export const round = (value: number, decimals = 4) => Number(value.toFixed(decimals));

/** sum(numerator) / sum(denominator); null on a zero denominator. */
export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? round(numerator / denominator) : null;
}

/** A rate above 1.0 is a broken upstream stage, not a fact. */
export function isImpossibleRate(numerator: number, denominator: number): boolean {
  return denominator > 0 && numerator / denominator > 1;
}

/** safeRatio plus the impossible-rate withhold. */
export function guardedRatio(numerator: number, denominator: number): number | null {
  if (isImpossibleRate(numerator, denominator)) return null;
  return safeRatio(numerator, denominator);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Craft floors used by the scorecard bands and the craft board verdicts.
 * These are provisional defaults (no per-tenant configuration exists yet);
 * the response flags them so the UI can say so instead of comparing silently.
 */
export const CREATIVE_CRAFT_FLOORS = {
  hookRate: 0.3,
  holdRate: 0.25,
  completionRate: 0.1,
  ctr: 0.02,
  cancellationRate: 0.25,
} as const;

export const CREATIVE_FLOORS_PROVISIONAL = true;

/**
 * Scorecard band weights. Quota (1.5 in the reference system) is deliberately
 * absent: this ERP has no daily-quota model, and an unmeasurable band is left
 * out of the weighted average rather than counted as zero.
 */
/**
 * Craft only. Approval rate used to sit here at weight 0.5, but it measures
 * whether a reviewer said yes — not whether the work was any good — and it
 * sits at or near 100% almost always, so it quietly lifted the score of
 * creatives whose hook and hold were never measured at all.
 */
/**
 * The craft bands shown on the scorecard. These are display only — they report
 * how the work is landing, but they no longer drive the 1–10 score, which is
 * graded on the owner's KPIs below.
 */
export const SCORECARD_BAND_WEIGHTS = {
  hookRate: 3,
  holdRate: 2,
  completionRate: 1.5,
  ctr: 1.5,
  // approvalRate (0.5 in the reference system) was dropped by request: the
  // dashboard no longer scores resolution, only craft.
} as const;

export type ScorecardBandKey = keyof typeof SCORECARD_BAND_WEIGHTS;

/** The owner's weighted KPIs — these, and only these, produce the 1–10 score. */
export const SCORECARD_KPI_WEIGHTS = {
  dailySpend: 4,
  adSpendRatio: 4,
  creativeOutput: 2,
} as const;

export type ScorecardKpiKey = keyof typeof SCORECARD_KPI_WEIGHTS;

/**
 * The owner's KPI targets behind the three bands. Daily spend and win rate are
 * floors (higher is better); the ad-spend ratio is a ceiling (lower is better)
 * and is scored on the inverted curve.
 *
 * The win-rate floor is the one figure the owner has not set — it is a
 * provisional default and the response flags it as such.
 */
export const SCORECARD_KPI_TARGETS = {
  dailySpend: 50_000,
  /** The owner's hard ceiling. 33% exists in their sheet only as headroom —
   *  30% is the line everything is graded against, matching the winner rule. */
  adSpendRatio: 0.3,
  /** Creative output is half volume, half quality — these are the two halves. */
  publishedPerPeriod: 8,
  winRate: 0.3,
} as const;

/** Neither half of the creative-output target has been set by the owner yet. */
export const SCORECARD_OUTPUT_TARGETS_PROVISIONAL = true;

/**
 * Creative output: how much was published against the volume target, averaged
 * with how much of it won. Rating volume alone rewards churning out work
 * nobody runs; rating quality alone lets one lucky winner carry a quiet month.
 * A half that cannot be measured is dropped rather than scored zero.
 */
export function creativeOutputScore(
  published: number | null,
  publishedTarget: number,
  winRate: number | null,
  winRateTarget: number,
): number | null {
  const halves = [
    bandScore(published, publishedTarget),
    bandScore(winRate, winRateTarget),
  ].filter((score): score is number => score !== null);
  if (halves.length === 0) return null;
  return round(halves.reduce((sum, score) => sum + score, 0) / halves.length, 1);
}

/**
 * Band scoring for a ceiling, where lower is better (a cost ratio). Mirrors
 * bandScore: sitting exactly on the ceiling scores 7, coming in at two-thirds
 * of it scores 10, and going over scales down toward 0.
 */
export function invertedBandScore(value: number | null, ceiling: number): number | null {
  if (value === null || ceiling <= 0) return null;
  if (value <= 0) return 10;
  const ratio = ceiling / value;
  const score = ratio >= 1 ? 7 + Math.min((ratio - 1) / 0.5, 1) * 3 : ratio * 7;
  return round(score, 1);
}

/**
 * Band scoring: hitting the floor exactly scores 7; 1.5× the floor scores 10;
 * below the floor scales linearly down to 0.
 */
export function bandScore(value: number | null, floor: number): number | null {
  if (value === null || floor <= 0) return null;
  const ratio = value / floor;
  const score = ratio >= 1 ? 7 + Math.min((ratio - 1) / 0.5, 1) * 3 : ratio * 7;
  return round(score, 1);
}

/**
 * Overall craft score: Σ(band × weight) ÷ Σ(weight of measurable bands),
 * clamped to 1…10. Missing bands are reweighted, never zeroed.
 */
export function weightedBandScore(
  bands: Array<{ score: number | null; weight: number }>,
): number | null {
  const measured = bands.filter(
    (band): band is { score: number; weight: number } => band.score !== null,
  );
  const totalWeight = measured.reduce((sum, band) => sum + band.weight, 0);
  if (totalWeight === 0) return null;
  const overall = measured.reduce((sum, band) => sum + band.score * band.weight, 0) / totalWeight;
  return round(Math.min(10, Math.max(1, overall)), 1);
}

/**
 * C-Score targets. The bar each band is graded against — hitting the bar
 * scores 7, one-and-a-half times it scores 10 (bandScore/invertedBandScore).
 *
 * Money bars come from the owner's winner rule (10 orders at ≤ 30% AR%);
 * craft bars are the market-normal "good" for this account's funnel
 * definitions (hook = 3s ÷ video impressions, hold = ThruPlay ÷ 3s plays,
 * CTR = link clicks ÷ impressions, CVR = orders ÷ LP views). The CVR bar is
 * the store's own median, floored so a store where everything is broken does
 * not grade itself against a broken bar.
 */
export const C_SCORE_TARGETS = {
  minOrders: 10,
  /** Spend that held at or under the AR% ceiling — "it survived scale". */
  provenSpend: 20_000,
  hookRate: 0.25,
  holdRate: 0.3,
  ctr: 0.015,
  cvrFloor: 0.05,
} as const;

/**
 * Money outweighs craft 60/40: the score's job is "is this creative making
 * money", with craft explaining why. `provenSpend` only counts while AR% is at
 * or under the ceiling — spend on a failing creative is not an achievement, so
 * over the ceiling its weight folds into AR% and efficiency matters more.
 */
export const C_SCORE_WEIGHTS = {
  arPct: 0.35,
  orders: 0.15,
  provenSpend: 0.1,
  hookRate: 0.14,
  holdRate: 0.1,
  ctr: 0.08,
  cvr: 0.08,
} as const;

/**
 * A static has no hook or hold to grade. Letting those weights renormalize
 * away would hand them to money, leaving an image graded ~79% on economics and
 * barely at all on the work — so they are redirected to the two bands that do
 * carry an image's craft.
 *
 * Hook is the scroll-stop, and for an image the click IS the scroll-stop, so
 * hook's weight goes to CTR. Hold is sustained interest, whose only static
 * analogue is whether that click became an order, so it goes to CVR. Both
 * kinds then sit at the same 60/40 money-to-craft balance.
 */
export const C_SCORE_STATIC_WEIGHTS = {
  ctr: C_SCORE_WEIGHTS.ctr + C_SCORE_WEIGHTS.hookRate,
  cvr: C_SCORE_WEIGHTS.cvr + C_SCORE_WEIGHTS.holdRate,
} as const;

export type CScoreInput = {
  kind: CreativeKind;
  /** Spend ÷ adjusted sales; null when there are no net sales yet. */
  arPct: number | null;
  arCeiling: number;
  orders: number;
  spend: number;
  hookRate: number | null;
  holdRate: number | null;
  ctr: number | null;
  cvr: number | null;
  storeMedianCvr: number | null;
};

/**
 * C-Score, 1–10: did the creative make money, and does the craft explain it.
 *
 * One formula for both kinds — a static simply has no hook or hold bands, so
 * they drop and the remaining weights renormalize (money carries ~73% of an
 * image's score instead of 60%). Unmeasured bands are always dropped, never
 * zeroed; the two deliberate exceptions are zero orders (a real 0 against the
 * 10-order bar, not missing data) and money spent against zero net sales,
 * which scores the AR% band 0 because "infinitely bad" must not grade better
 * than "62%".
 */
export function creativeCScore(input: CScoreInput): number | null {
  // Nothing delivered at all — there is no evidence to grade, and a 1.0 here
  // would read as a verdict on work that never ran.
  if (input.spend <= 0 && input.orders <= 0) return null;

  const held = input.arPct !== null && input.arPct <= input.arCeiling;
  const arBand = input.arPct !== null
    ? invertedBandScore(input.arPct, input.arCeiling)
    : input.spend > 0
      ? 0
      : null;

  const isVideo = input.kind === CreativeKind.VIDEO;
  const cvrTarget = Math.max(input.storeMedianCvr ?? 0, C_SCORE_TARGETS.cvrFloor);
  const bands: Array<{ score: number | null; weight: number }> = [
    { score: arBand, weight: C_SCORE_WEIGHTS.arPct + (held ? 0 : C_SCORE_WEIGHTS.provenSpend) },
    { score: bandScore(input.orders, C_SCORE_TARGETS.minOrders), weight: C_SCORE_WEIGHTS.orders },
    ...(held ? [{ score: bandScore(input.spend, C_SCORE_TARGETS.provenSpend), weight: C_SCORE_WEIGHTS.provenSpend }] : []),
    ...(isVideo
      ? [
          { score: bandScore(input.hookRate, C_SCORE_TARGETS.hookRate), weight: C_SCORE_WEIGHTS.hookRate },
          { score: bandScore(input.holdRate, C_SCORE_TARGETS.holdRate), weight: C_SCORE_WEIGHTS.holdRate },
        ]
      : []),
    {
      score: bandScore(input.ctr, C_SCORE_TARGETS.ctr),
      weight: isVideo ? C_SCORE_WEIGHTS.ctr : C_SCORE_STATIC_WEIGHTS.ctr,
    },
    {
      score: bandScore(input.cvr, cvrTarget),
      weight: isVideo ? C_SCORE_WEIGHTS.cvr : C_SCORE_STATIC_WEIGHTS.cvr,
    },
  ];
  return weightedBandScore(bands);
}

export type CreativeVerdict = 'SCALE' | 'REFRESH' | 'KILL' | 'TESTING';

export type CreativeVerdictInput = {
  /** True below the evidence gate — too little spend AND too few orders to judge. */
  testing: boolean;
  orders: number;
  spend: number;
  /** Spend ÷ adjusted sales. Null means no net sales at all. */
  arPct: number | null;
  /** The winner ceiling, normally 30%. */
  arCeiling: number;
  /** Past this, the money case is closed, normally 50%. */
  killLine: number;
  fatiguing: boolean;
  /** First funnel step under target, or null when the funnel reads clean. */
  bottleneck: string | null;
};

const BOTTLENECK_LABEL: Record<string, string> = {
  HOOK: 'Hook',
  HOLD: 'Hold',
  CTR: 'CTR',
  ORDER_RATE: 'CVR',
};

const asPct = (value: number) => `${(value * 100).toFixed(1)}%`;
const asPeso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

/**
 * Scale, refresh, or kill — first match wins.
 *
 * Money decides the verdict and craft explains it, because those are different
 * questions: whether a creative earns its spend, and whether a new cut could
 * change that. The pairing that matters most is bad AR% with a clean funnel —
 * that is an offer, price, or landing-page problem, and re-shooting the video
 * will not fix it. Saying so is the difference between a verdict and a guess.
 */
export function creativeVerdict(input: CreativeVerdictInput): { verdict: CreativeVerdict; reason: string } {
  const { orders, spend, arPct, arCeiling, killLine, fatiguing, bottleneck } = input;

  if (input.testing) {
    return {
      verdict: 'TESTING',
      reason: `Not enough evidence yet — ${orders} order${orders === 1 ? '' : 's'} on ${asPeso(spend)}.`,
    };
  }

  // A clean funnel under a failing AR% means the leak is downstream of the ad.
  const craftClean = bottleneck === null;
  const step = bottleneck ? BOTTLENECK_LABEL[bottleneck] ?? bottleneck : null;

  if (arPct === null && spend > 0) {
    return { verdict: 'KILL', reason: `${asPeso(spend)} spent with no net sales to show for it.` };
  }
  if (arPct !== null && arPct > killLine) {
    return {
      verdict: 'KILL',
      reason: craftClean
        ? `AR% ${asPct(arPct)} is past the ${asPct(killLine)} kill line, but the funnel reads clean — the leak is after the click, not in the cut.`
        : `AR% ${asPct(arPct)} is past the ${asPct(killLine)} kill line, and ${step} is under target.`,
    };
  }
  if (orders === 0) {
    return { verdict: 'KILL', reason: `${asPeso(spend)} spent and not one order.` };
  }

  const held = arPct !== null && arPct <= arCeiling;
  const proven = held && orders >= C_SCORE_TARGETS.minOrders;

  if (proven && !fatiguing) {
    return {
      verdict: 'SCALE',
      reason: `${orders} orders at ${asPct(arPct as number)} AR% — clear of the ${asPct(arCeiling)} ceiling.`,
    };
  }
  if (proven) {
    return {
      verdict: 'REFRESH',
      reason: `Winning at ${asPct(arPct as number)} AR% but marked fatigued — the idea is proven, the execution is worn.`,
    };
  }
  if (step) {
    return {
      verdict: 'REFRESH',
      reason: `${step} is the first step under target${arPct === null ? '' : ` at ${asPct(arPct)} AR%`} — remix that.`,
    };
  }
  if (arPct !== null && arPct > arCeiling) {
    return {
      verdict: 'REFRESH',
      reason: `AR% ${asPct(arPct)} has drifted past the ${asPct(arCeiling)} ceiling with the funnel still clean — try a sharper offer or angle.`,
    };
  }
  return {
    verdict: 'REFRESH',
    reason: `${orders} order${orders === 1 ? '' : 's'} — short of the ${C_SCORE_TARGETS.minOrders}-order bar. Give it more variations.`,
  };
}

export function scorecardVerdict(overall: number | null): string | null {
  if (overall === null) return null;
  // Deliberately names no single metric: the score is a weighted blend of three
  // KPIs now, so "focus on the hook" would point at something it no longer grades.
  if (overall >= 9) return 'Outstanding — every KPI is well clear of its target.';
  if (overall >= 7.5) return 'Strong. Consistently at or above target.';
  if (overall >= 6) return 'Solid, with one KPI still short of its target.';
  if (overall >= 4) return 'Mixed — some KPIs are under their target.';
  return 'Below target. Check which KPI is dragging the score.';
}

export type CraftVerdict = 'SCALE' | 'REFRESH' | 'RETIRE';

export type CraftSignals = {
  hookRate: number | null;
  holdRate: number | null;
  completionRate: number | null;
  ctr: number | null;
  cancellationRate: number | null;
  fatiguing: boolean;
};

/**
 * Craft board verdict, first match wins. "Kill" renders as Retire and "watch"
 * as Refresh in the UI. Statics ride a separate ladder graded on the click.
 */
export function craftVerdict(
  kind: CreativeKind,
  signals: CraftSignals,
  floors: typeof CREATIVE_CRAFT_FLOORS = CREATIVE_CRAFT_FLOORS,
): { verdict: CraftVerdict; reason: string } {
  const { hookRate, holdRate, completionRate, ctr, cancellationRate, fatiguing } = signals;
  const cancelKill = floors.cancellationRate * 1.25;
  if (kind === CreativeKind.STATIC) {
    if (cancellationRate !== null && cancellationRate > cancelKill)
      return { verdict: 'RETIRE', reason: 'Cancel rate over the kill line' };
    if (ctr !== null && ctr < floors.ctr * 0.8)
      return { verdict: 'RETIRE', reason: 'CTR under the kill line' };
    if (ctr !== null && ctr >= floors.ctr && !fatiguing)
      return { verdict: 'SCALE', reason: 'CTR at or above the floor' };
    return { verdict: 'REFRESH', reason: fatiguing ? 'Fatiguing' : 'CTR under the floor' };
  }
  if (hookRate !== null && hookRate < floors.hookRate * 0.8)
    return { verdict: 'RETIRE', reason: 'Hook under the kill line' };
  if (completionRate !== null && completionRate < floors.completionRate * 0.8)
    return { verdict: 'RETIRE', reason: 'Completion under the kill line' };
  if (cancellationRate !== null && cancellationRate > cancelKill)
    return { verdict: 'RETIRE', reason: 'Cancel rate over the kill line' };
  if (hookRate !== null && hookRate >= floors.hookRate
    && holdRate !== null && holdRate >= floors.holdRate && !fatiguing)
    return { verdict: 'SCALE', reason: 'Hook and hold at or above their floors' };
  return { verdict: 'REFRESH', reason: fatiguing ? 'Fatiguing' : 'Between the floor and the kill line' };
}
