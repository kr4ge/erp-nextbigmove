/**
 * CEO dashboard economics.
 *
 * The whole screen rests on ~20 stored values and the handful of figures
 * derived from them. Every formula lives here so a panel can never invent its
 * own definition of margin or break-even.
 *
 * Conventions:
 * - Rates are fractions in [0, 1]; a zero denominator returns null, never 0.
 * - Money is in pesos (the ERP's Decimal convention), rounded only at render.
 * - Cancelled orders are INCLUDED in the resolved base: you paid to acquire
 *   them too, so excluding them flatters every downstream figure.
 */

export const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

export function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export type OutcomeCounts = {
  delivered: number;
  cancelled: number;
  rts: number;
};

export type ResolvedRates = {
  resolvedBase: number;
  deliveryRate: number | null;
  cancelRate: number | null;
  rtsRate: number | null;
};

const PARTITION_TOLERANCE = 1e-9;

/**
 * The resolved base and its three-way partition. The rates always sum to
 * exactly 1 when anything has resolved; a violation means the inputs are
 * inconsistent, so all three are withheld rather than shown.
 */
export function resolvedRates({ delivered, cancelled, rts }: OutcomeCounts): ResolvedRates {
  const resolvedBase = delivered + cancelled + rts;
  if (resolvedBase <= 0) {
    return { resolvedBase: 0, deliveryRate: null, cancelRate: null, rtsRate: null };
  }
  const deliveryRate = delivered / resolvedBase;
  const cancelRate = cancelled / resolvedBase;
  const rtsRate = rts / resolvedBase;
  if (Math.abs(deliveryRate + cancelRate + rtsRate - 1) > PARTITION_TOLERANCE) {
    return { resolvedBase, deliveryRate: null, cancelRate: null, rtsRate: null };
  }
  return { resolvedBase, deliveryRate, cancelRate, rtsRate };
}

export type MarginInput = {
  deliveredValue: number;
  deliveredOrders: number;
  deliveredUnits: number;
  /** Reconciled cost of goods for delivered orders. */
  deliveredCogs: number;
  /** Reconciled shipping + fulfillment + insertion + COD fees on delivered orders. */
  fulfillmentCost: number;
};

export type MarginResult = {
  deliveredAov: number | null;
  /** Units inside a delivered order, floored at 1 — a delivered order shipped something. */
  unitsPerOrder: number;
  cogsPerUnit: number | null;
  fulfillmentPerParcel: number | null;
  /** Contribution left by one delivered order before ad cost. */
  margin: number | null;
};

/**
 * Per-delivered-order contribution.
 *
 * Cost of goods multiplies by units because a three-bottle order costs three
 * lots of product; fulfilment is per parcel because it ships once. Charging
 * fulfilment per unit would understate margin on exactly the multi-unit orders
 * a business is trying to encourage.
 */
export function computeMargin(input: MarginInput): MarginResult {
  const { deliveredValue, deliveredOrders, deliveredUnits, deliveredCogs, fulfillmentCost } = input;
  const deliveredAov = safeRatio(deliveredValue, deliveredOrders);
  const unitsPerOrder = Math.max(1, safeRatio(deliveredUnits, deliveredOrders) ?? 1);
  const cogsPerUnit = safeRatio(deliveredCogs, Math.max(deliveredUnits, 1));
  const fulfillmentPerParcel = safeRatio(fulfillmentCost, deliveredOrders);

  const margin = deliveredAov === null
    ? null
    : deliveredAov - (cogsPerUnit ?? 0) * unitsPerOrder - (fulfillmentPerParcel ?? 0);

  return { deliveredAov, unitsPerOrder, cogsPerUnit, fulfillmentPerParcel, margin };
}

export type BreakevenInput = {
  margin: number | null;
  deliveryRate: number | null;
  rtsRate: number | null;
  /** What one returned parcel costs — reconciled RTS value ÷ RTS orders. */
  rtsCostPerOrder: number | null;
};

/**
 * breakevenCPP = deliveryRate × margin − rtsRate × rtsCost
 *
 * The most a delivered order can afford to have cost in ads. Every judgment on
 * the screen measures against this rather than an absolute peso figure.
 */
export function computeBreakevenCpp(input: BreakevenInput): number | null {
  const { margin, deliveryRate, rtsRate, rtsCostPerOrder } = input;
  if (margin === null || deliveryRate === null) return null;
  const rtsPenalty = rtsRate !== null && rtsCostPerOrder !== null ? rtsRate * rtsCostPerOrder : 0;
  return deliveryRate * margin - rtsPenalty;
}

export type SafetyMargin = {
  cpp: number | null;
  breakevenCpp: number | null;
  /** breakevenCPP ÷ cpp — above 1 means each order can afford what it cost. */
  headroom: number | null;
  /** What is left per order after ad cost. */
  netPerOrder: number | null;
  tone: 'healthy' | 'warning' | 'critical' | 'unknown';
};

/** Below 1× is losing money; 1–2× is thin; above 2× has room to scale. */
export function computeSafetyMargin(adSpend: number, rawOrders: number, breakevenCpp: number | null): SafetyMargin {
  const cpp = safeRatio(adSpend, rawOrders);
  if (cpp === null || breakevenCpp === null || cpp <= 0) {
    return { cpp, breakevenCpp, headroom: null, netPerOrder: null, tone: 'unknown' };
  }
  const headroom = breakevenCpp / cpp;
  const netPerOrder = breakevenCpp - cpp;
  const tone = headroom < 1 ? 'critical' : headroom <= 2 ? 'warning' : 'healthy';
  return { cpp, breakevenCpp, headroom, netPerOrder, tone };
}

/** Tone thresholds for the acquisition card. */
export function cancelTone(cancelRate: number | null): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (cancelRate === null) return 'unknown';
  if (cancelRate > 0.2) return 'critical';
  if (cancelRate > 0.12) return 'warning';
  return 'healthy';
}

/** Tone thresholds for the retention card. */
export function repeatTone(repeatRate: number | null): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (repeatRate === null) return 'unknown';
  if (repeatRate < 0.1) return 'critical';
  if (repeatRate < 0.25) return 'warning';
  return 'healthy';
}

/** Tone for the finance card: losing money outranks a weak LTV:CAC. */
export function financeTone(netPerOrder: number | null, ltvCac: number | null): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (netPerOrder === null) return 'unknown';
  if (netPerOrder <= 0) return 'critical';
  if (ltvCac !== null && ltvCac >= 3) return 'healthy';
  return 'warning';
}

/**
 * "1 in N" reads as a picture where a percentage reads as a statistic.
 * Returns null when the rate cannot be expressed as a meaningful count.
 */
export function oneInN(rate: number | null): number | null {
  if (rate === null || rate <= 0) return null;
  return Math.round(1 / rate);
}

export type IntegrityCheck = { code: string; label: string; passed: boolean; detail?: string };

/**
 * Arithmetic self-checks that run before any figure is shown. These prove the
 * numbers are internally consistent — never that they are labelled correctly.
 */
export function runIntegrityChecks(input: {
  counts: OutcomeCounts;
  rates: ResolvedRates;
  rawOrders: number;
  bucketValueSum: number;
  totalOrderValue: number;
}): IntegrityCheck[] {
  const { counts, rates, rawOrders, bucketValueSum, totalOrderValue } = input;
  const checks: IntegrityCheck[] = [];

  const partitionSum = (rates.deliveryRate ?? 0) + (rates.cancelRate ?? 0) + (rates.rtsRate ?? 0);
  checks.push({
    code: 'RATE_PARTITION',
    label: 'Delivery, cancel and RTS rates sum to 100%',
    passed: rates.resolvedBase === 0 || Math.abs(partitionSum - 1) < 1e-6,
    detail: rates.resolvedBase === 0 ? 'Nothing has resolved yet' : `${(partitionSum * 100).toFixed(4)}%`,
  });

  checks.push({
    code: 'RESOLVED_BASE',
    label: 'Delivered + cancelled + returned equals the resolved base',
    passed: counts.delivered + counts.cancelled + counts.rts === rates.resolvedBase,
  });

  checks.push({
    code: 'RESOLVED_WITHIN_ORDERS',
    label: 'Resolved orders never exceed orders placed',
    passed: rates.resolvedBase <= rawOrders,
    detail: `${rates.resolvedBase} resolved of ${rawOrders} placed`,
  });

  checks.push({
    code: 'BUCKET_VALUE_SUM',
    label: 'Outcome values sum to the total order value',
    // Reconciled buckets are independently rounded, so allow a small drift.
    passed: totalOrderValue === 0 || Math.abs(bucketValueSum - totalOrderValue) / totalOrderValue < 0.01,
  });

  for (const [name, rate] of [['delivery', rates.deliveryRate], ['cancel', rates.cancelRate], ['rts', rates.rtsRate]] as const) {
    if (rate === null) continue;
    checks.push({
      code: `RATE_RANGE_${name.toUpperCase()}`,
      label: `The ${name} rate sits between 0% and 100%`,
      passed: rate >= 0 && rate <= 1,
    });
  }

  return checks;
}
