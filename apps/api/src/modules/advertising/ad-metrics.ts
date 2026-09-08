/**
 * Advertising economics and verdicts.
 *
 * Pure functions over rows of ReconcileMarketing — no database, no clock, no
 * tenant. Everything here is in INTEGER CENTAVOS; the caller converts at the
 * boundary. Money never touches a float, because a peso that rounds is a peso
 * an operator cannot reconcile against Pancake.
 *
 * Two deliberate omissions, both forced by what the manual CSV import carries:
 *
 *   - `leads` is ignored. On the manual upload path, workflow.service.ts packs
 *     websitePurchases into a landing_page_view action, so the column holds
 *     purchases rather than landing-page views. Reading it as a funnel stage
 *     would produce a confident, wrong answer.
 *   - No hook rate or hold rate. The export carries no video columns, so
 *     3-second plays and ThruPlays do not exist here. Creative retention is not
 *     something this module can speak to.
 */

/** One row of ReconcileMarketing, money already converted to centavos. */
export interface AdRow {
  adId: string;
  adName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  marketingAssociate: string | null;

  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;

  purchasesPos: number;
  processedPurchasesPos: number;

  deliveredCod: number;
  deliveredCogs: number;
  deliveredCodFee: number;
  rtsCogs: number;
  shippingFee: number;
  fulfillmentFee: number;
  insuranceFee: number;

  deliveredCount: number;
  shippedCount: number;
  canceledCount: number;
  rtsCount: number;
}

export interface Benchmark {
  cpp: number; // centavos
  cpm: number; // centavos
  ctrPct: number;
  deliveryRate: number;
  cancelRate: number;
  rtsRate: number;
  targetMer: number;
}

export type Verdict = 'SCALE' | 'WATCH' | 'KILL' | 'TOO_EARLY';

export interface AdEconomics {
  adId: string;
  adName: string | null;
  campaignName: string | null;
  marketingAssociate: string | null;

  spend: number;
  purchases: number;

  /** What the ad actually earned after everything it cost. Can be negative. */
  netContribution: number;
  /** Delivered COD over spend. The only revenue multiple worth trusting here. */
  realizedMer: number | null;
  /** Spend per POS purchase. */
  cpp: number | null;
  cpm: number | null;
  ctrPct: number | null;

  deliveryRate: number | null;
  cancelRate: number | null;
  rtsRate: number | null;

  verdict: Verdict;
  /** Plain-language reason, so a console never shows a verdict it cannot justify. */
  reason: string;
}

/** Division that yields null rather than NaN or Infinity. */
function ratio(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator)) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

/**
 * Sum a set of daily rows into one position.
 *
 * Rates are always recomputed from the summed counts, never averaged from each
 * row's own rate. Averaging lets a day with 200 impressions pull the number as
 * hard as one with 40,000.
 */
export function aggregate(rows: AdRow[]): AdRow | null {
  if (!rows.length) return null;
  const head = rows[0];
  const sum = (pick: (r: AdRow) => number) => rows.reduce((t, r) => t + pick(r), 0);

  return {
    adId: head.adId,
    adName: head.adName,
    campaignId: head.campaignId,
    campaignName: head.campaignName,
    marketingAssociate: head.marketingAssociate,

    spend: sum((r) => r.spend),
    impressions: sum((r) => r.impressions),
    clicks: sum((r) => r.clicks),
    linkClicks: sum((r) => r.linkClicks),

    purchasesPos: sum((r) => r.purchasesPos),
    processedPurchasesPos: sum((r) => r.processedPurchasesPos),

    deliveredCod: sum((r) => r.deliveredCod),
    deliveredCogs: sum((r) => r.deliveredCogs),
    deliveredCodFee: sum((r) => r.deliveredCodFee),
    rtsCogs: sum((r) => r.rtsCogs),
    shippingFee: sum((r) => r.shippingFee),
    fulfillmentFee: sum((r) => r.fulfillmentFee),
    insuranceFee: sum((r) => r.insuranceFee),

    deliveredCount: sum((r) => r.deliveredCount),
    shippedCount: sum((r) => r.shippedCount),
    canceledCount: sum((r) => r.canceledCount),
    rtsCount: sum((r) => r.rtsCount),
  };
}

/**
 * What the ad is worth, after everything.
 *
 * Only DELIVERED money counts as revenue. An order that was placed but never
 * collected is not income, and treating it as such is precisely how a low-CPP
 * ad with a cancel problem gets mistaken for a winner.
 *
 * Costs subtracted: goods that went out and were delivered, goods lost to RTS,
 * the shipping, fulfillment and insurance actually incurred, the COD collection
 * fee on delivered orders, and the ad spend itself.
 *
 * NOTE: this treats sfPos / ffPos / ifPos as costs incurred on the whole
 * period's orders rather than delivered ones only, because ReconcileMarketing
 * does not split them by outcome. Where the two differ, this errs toward
 * pessimism — an ad this calls profitable is profitable.
 */
export function netContribution(r: AdRow): number {
  return (
    r.deliveredCod
    - r.deliveredCogs
    - r.deliveredCodFee
    - r.rtsCogs
    - r.shippingFee
    - r.fulfillmentFee
    - r.insuranceFee
    - r.spend
  );
}

/**
 * How many purchases an ad needs before its rates mean anything.
 *
 * Below this, one cancellation swings the cancel rate by twenty points and any
 * verdict is noise wearing a number's clothes.
 */
export const MIN_PURCHASES_FOR_VERDICT = 5;

export function evaluate(row: AdRow, benchmark: Benchmark): AdEconomics {
  const net = netContribution(row);
  const cpp = ratio(row.spend, row.purchasesPos);
  const cpm = ratio(row.spend * 1000, row.impressions);
  const ctrPct = ratio(row.linkClicks * 100, row.impressions);
  const realizedMer = ratio(row.deliveredCod, row.spend);
  const deliveryRate = ratio(row.deliveredCount, row.processedPurchasesPos);
  const cancelRate = ratio(row.canceledCount, row.purchasesPos);
  const rtsRate = ratio(row.rtsCount, row.shippedCount);

  const base = {
    adId: row.adId,
    adName: row.adName,
    campaignName: row.campaignName,
    marketingAssociate: row.marketingAssociate,
    spend: row.spend,
    purchases: row.purchasesPos,
    netContribution: net,
    realizedMer,
    cpp,
    cpm,
    ctrPct,
    deliveryRate,
    cancelRate,
    rtsRate,
  };

  // Spending with nothing to show is the one call that needs no sample size.
  if (row.purchasesPos === 0) {
    return row.spend > 0
      ? { ...base, verdict: 'KILL', reason: 'Spending with no POS orders attributed.' }
      : { ...base, verdict: 'TOO_EARLY', reason: 'No spend and no orders in this period.' };
  }

  if (row.purchasesPos < MIN_PURCHASES_FOR_VERDICT) {
    return {
      ...base,
      verdict: 'TOO_EARLY',
      reason: `Only ${row.purchasesPos} order(s) — too few to judge rates on.`,
    };
  }

  if (net < 0) {
    return {
      ...base,
      verdict: 'KILL',
      reason: `Losing money: net contribution is ${formatPeso(net)} after all costs.`,
    };
  }

  const overCpp = cpp !== null && cpp > benchmark.cpp;
  const underMer = realizedMer !== null && realizedMer < benchmark.targetMer;
  const badDelivery = deliveryRate !== null && deliveryRate < benchmark.deliveryRate;
  const badCancel = cancelRate !== null && cancelRate > benchmark.cancelRate;
  const badRts = rtsRate !== null && rtsRate > benchmark.rtsRate;

  const misses = [
    overCpp && `CPP ${formatPeso(cpp!)} over the ${formatPeso(benchmark.cpp)} ceiling`,
    underMer && `MER ${realizedMer!.toFixed(2)}× under the ${benchmark.targetMer}× floor`,
    badDelivery && `delivery ${pct(deliveryRate!)} under ${pct(benchmark.deliveryRate)}`,
    badCancel && `cancels ${pct(cancelRate!)} over ${pct(benchmark.cancelRate)}`,
    badRts && `RTS ${pct(rtsRate!)} over ${pct(benchmark.rtsRate)}`,
  ].filter(Boolean) as string[];

  if (!misses.length) {
    return {
      ...base,
      verdict: 'SCALE',
      reason: `Profitable at ${formatPeso(net)} and clearing every benchmark.`,
    };
  }

  return {
    ...base,
    verdict: 'WATCH',
    reason: `Profitable at ${formatPeso(net)} but ${misses.join('; ')}.`,
  };
}

/** Rank by what an ad is worth, never by ROAS. */
export function rankByContribution(rows: AdEconomics[]): AdEconomics[] {
  return [...rows].sort((a, b) => b.netContribution - a.netContribution);
}

export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const sign = pesos < 0 ? '-' : '';
  return `${sign}₱${Math.abs(pesos).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
