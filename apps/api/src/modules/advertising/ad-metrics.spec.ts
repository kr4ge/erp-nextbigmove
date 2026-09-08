import { describe, expect, it } from '@jest/globals';
import {
  MIN_PURCHASES_FOR_VERDICT,
  aggregate,
  evaluate,
  netContribution,
  rankByContribution,
  type AdRow,
  type Benchmark,
} from './ad-metrics';

const BENCHMARK: Benchmark = {
  cpp: 30000, // ₱300
  cpm: 15000,
  ctrPct: 2.0,
  deliveryRate: 0.55,
  cancelRate: 0.25,
  rtsRate: 0.1,
  targetMer: 2.5,
};

function row(overrides: Partial<AdRow> = {}): AdRow {
  return {
    adId: 'ad-1',
    adName: 'Test ad',
    campaignId: 'camp-1',
    campaignName: 'Test campaign',
    marketingAssociate: null,

    spend: 100000, // ₱1,000
    impressions: 10000,
    clicks: 300,
    linkClicks: 200,

    purchasesPos: 10,
    processedPurchasesPos: 10,

    deliveredCod: 500000, // ₱5,000
    deliveredCogs: 150000,
    deliveredCodFee: 10000,
    rtsCogs: 0,
    shippingFee: 20000,
    fulfillmentFee: 10000,
    insuranceFee: 0,

    deliveredCount: 8,
    shippedCount: 10,
    canceledCount: 1,
    rtsCount: 0,
    ...overrides,
  };
}

describe('netContribution', () => {
  it('counts only delivered money as revenue', () => {
    // 5000 - 1500 - 100 - 0 - 200 - 100 - 0 - 1000 = 2100 pesos
    expect(netContribution(row())).toBe(210000);
  });

  it('goes negative when costs exceed what was delivered', () => {
    expect(netContribution(row({ deliveredCod: 50000 }))).toBeLessThan(0);
  });

  it('charges RTS goods against the ad that produced them', () => {
    const withRts = netContribution(row({ rtsCogs: 60000 }));
    expect(netContribution(row()) - withRts).toBe(60000);
  });
});

describe('evaluate', () => {
  it('scales an ad that is profitable and clears every benchmark', () => {
    const result = evaluate(row(), BENCHMARK);
    expect(result.verdict).toBe('SCALE');
    expect(result.netContribution).toBe(210000);
  });

  it('kills an ad that spends with nothing attributed, regardless of sample size', () => {
    const result = evaluate(row({ purchasesPos: 0, deliveredCod: 0 }), BENCHMARK);
    expect(result.verdict).toBe('KILL');
    expect(result.reason).toContain('no POS orders');
  });

  it('kills a losing ad even when its rates look healthy', () => {
    const result = evaluate(row({ deliveredCod: 100000 }), BENCHMARK);
    expect(result.verdict).toBe('KILL');
    expect(result.netContribution).toBeLessThan(0);
  });

  it('withholds a verdict below the minimum sample', () => {
    const result = evaluate(
      row({ purchasesPos: MIN_PURCHASES_FOR_VERDICT - 1, processedPurchasesPos: 4 }),
      BENCHMARK,
    );
    expect(result.verdict).toBe('TOO_EARLY');
  });

  it('watches a profitable ad that misses a benchmark, and names the miss', () => {
    // 10 orders on ₱4,000 spend is ₱400 CPP, over the ₱300 ceiling.
    const result = evaluate(row({ spend: 400000, deliveredCod: 1500000 }), BENCHMARK);
    expect(result.verdict).toBe('WATCH');
    expect(result.reason).toContain('CPP');
  });

  it('flags a high cancel rate on an otherwise profitable ad', () => {
    const result = evaluate(row({ canceledCount: 5 }), BENCHMARK);
    expect(result.verdict).toBe('WATCH');
    expect(result.reason).toContain('cancels');
  });

  it('reports null rather than Infinity when a denominator is zero', () => {
    const result = evaluate(row({ impressions: 0, shippedCount: 0 }), BENCHMARK);
    expect(result.cpm).toBeNull();
    expect(result.ctrPct).toBeNull();
    expect(result.rtsRate).toBeNull();
  });

  it('says nothing at all about an empty ad', () => {
    const result = evaluate(
      row({ spend: 0, purchasesPos: 0, deliveredCod: 0, deliveredCogs: 0, deliveredCodFee: 0, shippingFee: 0, fulfillmentFee: 0 }),
      BENCHMARK,
    );
    expect(result.verdict).toBe('TOO_EARLY');
  });
});

describe('aggregate', () => {
  it('sums daily rows into one position', () => {
    const folded = aggregate([row(), row({ spend: 50000, purchasesPos: 5 })]);
    expect(folded?.spend).toBe(150000);
    expect(folded?.purchasesPos).toBe(15);
  });

  it('recomputes rates from summed counts rather than averaging them', () => {
    // A tiny day at 100% delivery must not drag a large day at 50% up to 75%.
    const big = row({ impressions: 40000, linkClicks: 400, deliveredCount: 5, processedPurchasesPos: 10, purchasesPos: 10 });
    const tiny = row({ impressions: 200, linkClicks: 20, deliveredCount: 1, processedPurchasesPos: 1, purchasesPos: 1 });
    const folded = aggregate([big, tiny])!;
    const result = evaluate(folded, BENCHMARK);
    // 6 delivered of 11 processed = 54.5%, not the 75% an average would give.
    expect(result.deliveryRate).toBeCloseTo(6 / 11, 5);
  });

  it('returns null for no rows', () => {
    expect(aggregate([])).toBeNull();
  });
});

describe('rankByContribution', () => {
  it('ranks by what an ad is worth, not by how cheap its orders were', () => {
    const cheapButLosing = evaluate(row({ adId: 'cheap', spend: 20000, deliveredCod: 10000 }), BENCHMARK);
    const pricierButEarning = evaluate(row({ adId: 'pricier', spend: 200000, deliveredCod: 900000 }), BENCHMARK);

    const ranked = rankByContribution([cheapButLosing, pricierButEarning]);
    expect(ranked[0].adId).toBe('pricier');
    expect(ranked[0].cpp).toBeGreaterThan(ranked[1].cpp!);
  });
});
