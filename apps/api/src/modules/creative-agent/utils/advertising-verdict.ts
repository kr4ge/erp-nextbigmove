/**
 * The Scale/Watch/Kill verdict ladder — a pure, deterministic function.
 * First match wins. A verdict is a recommendation for a human, never an
 * automatic Meta mutation.
 *
 * Two flags every verdict carries:
 * - `decided` — false when the ad has not bought enough data to be judged;
 *   the UI says "too early" instead of implying it was weighed and found
 *   wanting.
 * - `needsAction` — true only when something should happen today.
 *
 * When order-attribution coverage is below the minimum, the verdict is
 * suppressed entirely (`suppressed: true`, verdict null) — a verdict drawn
 * from a fifth of the orders is a guess wearing a badge.
 */

export const MIN_SPEND_MULTIPLE = 1;
export const KILL_SPEND_MULTIPLE = 2;
export const CPP_KILL_MULTIPLE = 1.5;

export type VerdictLabel = 'SCALE' | 'WATCH' | 'KILL';

export type VerdictRoute = 'CONFIRMATION' | 'FULFILLMENT' | null;

export type AdvertisingVerdictInput = {
  spend: number;
  orders: number;
  /** spend ÷ orders; null when orders = 0. */
  cpp: number | null;
  /** Working ceiling (configured target or provisional break-even derived). */
  ceiling: number | null;
  ctr: number | null;
  benchmarkCtr: number | null;
  cancellationRate: number | null;
  maxCancellationRate: number | null;
  netContribution: number | null;
  /** Order-attribution coverage for the current scope, 0..1; null = unknown. */
  attributionCoverage: number | null;
  minAttributionCoverage: number;
};

export type AdvertisingVerdict = {
  verdict: VerdictLabel | null;
  decided: boolean;
  needsAction: boolean;
  suppressed: boolean;
  /** One quantified sentence. */
  reason: string;
  /** Which owner the issue routes to when the problem is not the ad. */
  route: VerdictRoute;
};

const peso = (value: number) =>
  `₱${Math.round(value).toLocaleString('en-PH')}`;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function result(
  verdict: VerdictLabel | null,
  decided: boolean,
  needsAction: boolean,
  reason: string,
  route: VerdictRoute = null,
  suppressed = false,
): AdvertisingVerdict {
  return { verdict, decided, needsAction, suppressed, reason, route };
}

export function advertisingVerdict(input: AdvertisingVerdictInput): AdvertisingVerdict {
  const {
    spend, orders, cpp, ceiling, ctr, benchmarkCtr,
    cancellationRate, maxCancellationRate, netContribution,
    attributionCoverage, minAttributionCoverage,
  } = input;

  if (attributionCoverage !== null && attributionCoverage < minAttributionCoverage) {
    return result(
      null, false, false,
      `Attribution coverage ${pct(attributionCoverage)} is below ${pct(minAttributionCoverage)} — verdicts are suppressed.`,
      null, true,
    );
  }

  if (orders <= 0) {
    if (ceiling === null) {
      return result('WATCH', false, false, 'No cost ceiling is configured, so spend cannot be judged yet.');
    }
    if (spend >= ceiling * KILL_SPEND_MULTIPLE) {
      return result('KILL', true, true,
        `${peso(spend)} spent — ${KILL_SPEND_MULTIPLE}× the ${peso(ceiling)} ceiling — with zero POS orders.`);
    }
    if (spend < ceiling * MIN_SPEND_MULTIPLE) {
      return result('WATCH', false, false,
        `Too early — ${peso(spend)} spent is below one ceiling (${peso(ceiling)}).`);
    }
    if (ctr !== null && benchmarkCtr !== null && ctr >= benchmarkCtr) {
      return result('WATCH', true, true,
        `Zero orders at ${peso(spend)} spend, but CTR ${pct(ctr)} meets the ${pct(benchmarkCtr)} benchmark — traffic engages; the leak is after the click.`);
    }
    return result('KILL', true, true,
      `${peso(spend)} spent past the ${peso(ceiling)} ceiling with zero orders and no clicks worth the name.`);
  }

  if (ceiling === null || cpp === null) {
    return result('WATCH', false, false, 'No cost ceiling or CPP available, so this ad cannot be judged yet.');
  }
  if (cpp > ceiling * CPP_KILL_MULTIPLE) {
    return result('KILL', true, true,
      `CPP ${peso(cpp)} is more than ${CPP_KILL_MULTIPLE}× the ${peso(ceiling)} ceiling — too far gone for a bid tweak.`);
  }
  if (cancellationRate !== null && maxCancellationRate !== null && cancellationRate > maxCancellationRate) {
    return result('WATCH', true, true,
      `Cancellation ${pct(cancellationRate)} exceeds the ${pct(maxCancellationRate)} target — route to order confirmation, not the ad.`,
      'CONFIRMATION');
  }
  if (cpp > ceiling) {
    return result('WATCH', true, true,
      `CPP ${peso(cpp)} is above the ${peso(ceiling)} ceiling — trim cost before scaling.`);
  }
  if (netContribution !== null && netContribution < 0) {
    return result('WATCH', true, true,
      `Net contribution ${peso(netContribution)} is below zero despite CPP under the ceiling — a delivery/economics problem, not the ad.`,
      'FULFILLMENT');
  }
  return result('SCALE', true, false,
    `CPP ${peso(cpp)} sits under the ${peso(ceiling)} ceiling with ${orders} POS order${orders === 1 ? '' : 's'} and positive economics.`);
}
