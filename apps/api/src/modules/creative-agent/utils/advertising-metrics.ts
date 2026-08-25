import { guardedRatio, round, safeRatio } from './creative-metrics';

/**
 * Shared advertising metric math. Every advertising surface (dashboard,
 * performance table, needs-action preview) must go through these helpers so a
 * formula is defined exactly once, next to the creative helpers it extends.
 *
 * Conventions (same as creative-metrics):
 * - Probability-style rates are fractions in [0, 1]; a value above 1 is a
 *   broken upstream stage and is withheld as null (guardedRatio).
 * - Cost ratios (CPC, CPP, ad-spend ratio) are NOT probabilities — an ad can
 *   legitimately spend more than it sells (AR% above 100%), so they use
 *   safeRatio and are never withheld for exceeding 1.
 * - A zero denominator always returns null; null renders as an em dash.
 * - Money stays in the ERP's peso Decimal convention (numbers at this layer).
 */

/**
 * Centralized provisional fallbacks, used only when no configured value
 * exists. Every consumer must surface `provisional: true` alongside any figure
 * derived from these, and the UI must say the comparison is provisional.
 */
export const ADVERTISING_PROVISIONAL_DEFAULTS = {
  /** Working ceiling = breakevenCPP × (1 − safetyMargin) when no target CPP is configured. */
  safetyMargin: 0.2,
  /** CTR benchmark for the zero-order verdict branch; mirrors the creative craft floor. */
  benchmarkCtr: 0.02,
  /** Cancellation-rate target; mirrors the creative craft floor. */
  maxCancellationRate: 0.25,
  /** Below this order-attribution coverage, per-ad verdicts are suppressed. */
  minAttributionCoverage: 0.7,
  /** Ad-spend-ratio display/alert thresholds: ≤ healthy is good, ≤ warning is caution. */
  adSpendRatioHealthy: 0.3,
  adSpendRatioWarning: 0.5,
} as const;

export type ResolvedRates = {
  resolved: number;
  deliveryRate: number | null;
  cancellationRate: number | null;
  rtsRate: number | null;
};

const PARTITION_TOLERANCE = 1e-6;

/**
 * The COD resolution base. When resolved > 0 the three rates partition it and
 * must sum to 1 within numerical tolerance; a violation means the inputs are
 * inconsistent, so all three rates are withheld rather than rendered.
 */
export function resolvedRates(delivered: number, cancelled: number, rts: number): ResolvedRates {
  const resolved = delivered + cancelled + rts;
  if (resolved <= 0) {
    return { resolved: 0, deliveryRate: null, cancellationRate: null, rtsRate: null };
  }
  const sum = delivered / resolved + cancelled / resolved + rts / resolved;
  if (Math.abs(sum - 1) > PARTITION_TOLERANCE) {
    return { resolved, deliveryRate: null, cancellationRate: null, rtsRate: null };
  }
  return {
    resolved,
    deliveryRate: round(delivered / resolved),
    cancellationRate: round(cancelled / resolved),
    rtsRate: round(rts / resolved),
  };
}

/** spend ÷ link clicks. Currency ratio — never withheld for exceeding 1. */
export const costPerClick = (spend: number, linkClicks: number) => safeRatio(spend, linkClicks);

/** spend ÷ POS orders placed. */
export const costPerOrder = (spend: number, orders: number) => safeRatio(spend, orders);

/** spend ÷ delivered orders. Labelled "Delivered CPP" everywhere. */
export const deliveredCostPerOrder = (spend: number, delivered: number) => safeRatio(spend, delivered);

/**
 * Ad spend ratio ("AR%" as supporting label): spend ÷ gross POS sales.
 * Lower is better; legitimately exceeds 1 when spend outruns sales.
 */
export const adSpendRatio = (spend: number, grossSales: number) => safeRatio(spend, grossSales);

/** 3-second plays ÷ measured video impressions. */
export const hookRate = (plays3s: number, videoImpressions: number) => guardedRatio(plays3s, videoImpressions);

/** ThruPlays ÷ 3-second plays. */
export const holdRate = (thruPlays: number, plays3s: number) => guardedRatio(thruPlays, plays3s);

/** ThruPlays ÷ measured video impressions. */
export const completionRate = (thruPlays: number, videoImpressions: number) => guardedRatio(thruPlays, videoImpressions);

/** Link clicks ÷ impressions. */
export const clickThroughRate = (linkClicks: number, impressions: number) => guardedRatio(linkClicks, impressions);

/** Landing-page views ÷ link clicks. */
export const landingPageRate = (lpViews: number, linkClicks: number) => guardedRatio(lpViews, linkClicks);

/**
 * CVR: POS orders ÷ landing-page views. When landing-page views are absent the
 * value is null — link clicks are never silently substituted.
 */
export const conversionRate = (orders: number, lpViews: number) => guardedRatio(orders, lpViews);

export type NetContributionInput = {
  deliveredRevenue: number;
  deliveredCogs: number;
  fulfillmentCosts: number;
  spend: number;
};

/**
 * Reconciled net contribution — the ERP's existing P&L shape (identical to the
 * creative overview's netMargin): delivered COD revenue minus delivered COGS,
 * minus reconciled shipping/fulfillment/inventory/COD fees, minus ad spend.
 */
export function netContribution({ deliveredRevenue, deliveredCogs, fulfillmentCosts, spend }: NetContributionInput): number {
  return round(deliveredRevenue - deliveredCogs - fulfillmentCosts - spend, 2);
}

export type CeilingInput = {
  deliveredRevenue: number;
  deliveredCogs: number;
  fulfillmentCosts: number;
  deliveredCount: number;
  deliveryRate: number | null;
  rtsRate: number | null;
  /** Per-RTS-order cost. Null when no configured/derivable source exists. */
  rtsCostPerRtsOrder: number | null;
  /** Configured target CPP; wins over the computed break-even when present. */
  configuredTargetCpp: number | null;
  safetyMargin?: number;
};

export type CeilingResult = {
  marginPerDeliveredOrder: number | null;
  breakevenCpp: number | null;
  workingCeiling: number | null;
  /** True whenever the ceiling rests on a fallback instead of configuration. */
  provisional: boolean;
};

/**
 * The COD cost ceiling every verdict measures against.
 *
 *   marginPerDeliveredOrder = (delivered revenue − attributable delivered costs) ÷ delivered count
 *   breakevenCPP            = deliveryRate × margin − rtsRate × rtsCostPerRtsOrder
 *   workingCeiling          = configuredTargetCPP ?? breakevenCPP × (1 − safetyMargin)
 *
 * A missing RTS cost source degrades the break-even (the RTS term drops out)
 * and marks the result provisional rather than inventing a peso figure.
 */
export function codCeiling(input: CeilingInput): CeilingResult {
  const {
    deliveredRevenue, deliveredCogs, fulfillmentCosts, deliveredCount,
    deliveryRate, rtsRate, rtsCostPerRtsOrder, configuredTargetCpp,
    safetyMargin = ADVERTISING_PROVISIONAL_DEFAULTS.safetyMargin,
  } = input;

  const marginPerDeliveredOrder = deliveredCount > 0
    ? round((deliveredRevenue - deliveredCogs - fulfillmentCosts) / deliveredCount, 2)
    : null;

  let breakevenCpp: number | null = null;
  let rtsTermMissing = false;
  if (marginPerDeliveredOrder !== null && deliveryRate !== null) {
    let value = deliveryRate * marginPerDeliveredOrder;
    if (rtsRate !== null && rtsRate > 0) {
      if (rtsCostPerRtsOrder === null) {
        rtsTermMissing = true;
      } else {
        value -= rtsRate * rtsCostPerRtsOrder;
      }
    }
    breakevenCpp = round(value, 2);
  }

  if (configuredTargetCpp !== null) {
    return { marginPerDeliveredOrder, breakevenCpp, workingCeiling: configuredTargetCpp, provisional: false };
  }

  const workingCeiling = breakevenCpp !== null && breakevenCpp > 0
    ? round(breakevenCpp * (1 - safetyMargin), 2)
    : null;
  return { marginPerDeliveredOrder, breakevenCpp, workingCeiling, provisional: workingCeiling !== null || rtsTermMissing };
}

/** headroom = 1 − cpp ÷ breakevenCPP. Display/tone helper for the CPP cell. */
export function cppHeadroom(cpp: number | null, breakevenCpp: number | null): number | null {
  if (cpp === null || breakevenCpp === null || breakevenCpp <= 0) return null;
  return round(1 - cpp / breakevenCpp);
}
