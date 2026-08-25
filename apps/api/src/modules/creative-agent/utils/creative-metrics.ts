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
export const SCORECARD_BAND_WEIGHTS = {
  hookRate: 3,
  holdRate: 2,
  completionRate: 1.5,
  ctr: 1.5,
  approvalRate: 0.5,
} as const;

export type ScorecardBandKey = keyof typeof SCORECARD_BAND_WEIGHTS;

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

export function scorecardVerdict(overall: number | null): string | null {
  if (overall === null) return null;
  if (overall >= 9) return 'Outstanding — this is scale-worthy work.';
  if (overall >= 7.5) return 'Strong. Consistently at or above the bar.';
  if (overall >= 6) return 'Solid, with room to push the hook higher.';
  if (overall >= 4) return 'Mixed — some KPIs are under their floor.';
  return 'Below the bar. Focus on the hook first.';
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
