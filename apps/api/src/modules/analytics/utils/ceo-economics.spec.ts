import { describe, expect, it } from '@jest/globals';
import {
  cancelTone,
  computeBreakevenCpp,
  computeMargin,
  computeSafetyMargin,
  financeTone,
  oneInN,
  repeatTone,
  resolvedRates,
  runIntegrityChecks,
  safeRatio,
} from './ceo-economics';

describe('resolved base and the three rates', () => {
  it('partitions exactly — the three rates sum to 1.0', () => {
    const rates = resolvedRates({ delivered: 230, cancelled: 62, rts: 116 });
    expect(rates.resolvedBase).toBe(408);
    expect((rates.deliveryRate as number) + (rates.cancelRate as number) + (rates.rtsRate as number)).toBeCloseTo(1, 12);
  });

  it('includes cancelled orders in the base — excluding them flatters delivery', () => {
    const withCancels = resolvedRates({ delivered: 50, cancelled: 50, rts: 0 });
    expect(withCancels.deliveryRate).toBe(0.5);
  });

  it('returns nulls rather than zeros when nothing has resolved', () => {
    const rates = resolvedRates({ delivered: 0, cancelled: 0, rts: 0 });
    expect(rates.deliveryRate).toBeNull();
    expect(rates.cancelRate).toBeNull();
    expect(rates.rtsRate).toBeNull();
  });

  it('keeps every rate inside [0,1]', () => {
    const rates = resolvedRates({ delivered: 1, cancelled: 2, rts: 3 });
    for (const rate of [rates.deliveryRate, rates.cancelRate, rates.rtsRate]) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });
});

describe('margin', () => {
  const base = {
    deliveredValue: 100_000, deliveredOrders: 100, deliveredUnits: 200,
    deliveredCogs: 30_000, fulfillmentCost: 10_000,
  };

  it('multiplies cost of goods by units but charges fulfilment once per parcel', () => {
    const margin = computeMargin(base);
    expect(margin.deliveredAov).toBe(1000);
    expect(margin.unitsPerOrder).toBe(2);
    expect(margin.cogsPerUnit).toBe(150);
    expect(margin.fulfillmentPerParcel).toBe(100);
    // 1000 − 150×2 − 100
    expect(margin.margin).toBe(600);
  });

  it('floors units per order at 1 so product cost is never erased', () => {
    const margin = computeMargin({ ...base, deliveredUnits: 0 });
    expect(margin.unitsPerOrder).toBe(1);
  });

  it('returns a null margin when nothing has been delivered', () => {
    const margin = computeMargin({ ...base, deliveredOrders: 0, deliveredValue: 0 });
    expect(margin.deliveredAov).toBeNull();
    expect(margin.margin).toBeNull();
  });
});

describe('break-even CPP', () => {
  it('subtracts the RTS penalty from the delivered contribution', () => {
    // 0.6 × 600 − 0.1 × 200 = 340
    expect(computeBreakevenCpp({ margin: 600, deliveryRate: 0.6, rtsRate: 0.1, rtsCostPerOrder: 200 })).toBe(340);
  });

  it('drops the RTS term when no cost source exists rather than inventing one', () => {
    expect(computeBreakevenCpp({ margin: 600, deliveryRate: 0.6, rtsRate: 0.1, rtsCostPerOrder: null })).toBe(360);
  });

  it('is null when margin or delivery rate is unknown', () => {
    expect(computeBreakevenCpp({ margin: null, deliveryRate: 0.6, rtsRate: 0.1, rtsCostPerOrder: 200 })).toBeNull();
    expect(computeBreakevenCpp({ margin: 600, deliveryRate: null, rtsRate: 0.1, rtsCostPerOrder: 200 })).toBeNull();
  });
});

describe('safety margin', () => {
  it('is critical below 1× — every order loses money', () => {
    const safety = computeSafetyMargin(10_000, 10, 500);
    expect(safety.cpp).toBe(1000);
    expect(safety.headroom).toBe(0.5);
    expect(safety.netPerOrder).toBe(-500);
    expect(safety.tone).toBe('critical');
  });

  it('is thin between 1× and 2×', () => {
    expect(computeSafetyMargin(10_000, 10, 1480).tone).toBe('warning');
  });

  it('has room to scale above 2×', () => {
    expect(computeSafetyMargin(10_000, 10, 3000).tone).toBe('healthy');
  });

  it('is unknown rather than zero when there is no break-even', () => {
    const safety = computeSafetyMargin(10_000, 10, null);
    expect(safety.headroom).toBeNull();
    expect(safety.tone).toBe('unknown');
  });
});

describe('tones and copy helpers', () => {
  it('grades cancel rate against the reference thresholds', () => {
    expect(cancelTone(0.25)).toBe('critical');
    expect(cancelTone(0.15)).toBe('warning');
    expect(cancelTone(0.05)).toBe('healthy');
    expect(cancelTone(null)).toBe('unknown');
  });

  it('grades repeat rate against the reference thresholds', () => {
    expect(repeatTone(0.05)).toBe('critical');
    expect(repeatTone(0.2)).toBe('warning');
    expect(repeatTone(0.3)).toBe('healthy');
  });

  it('treats losing money as critical regardless of LTV:CAC', () => {
    expect(financeTone(-100, 5)).toBe('critical');
    expect(financeTone(300, 3.2)).toBe('healthy');
    expect(financeTone(300, 1.2)).toBe('warning');
  });

  it('turns a rate into a countable "1 in N"', () => {
    expect(oneInN(0.152)).toBe(7);
    expect(oneInN(0.2)).toBe(5);
    expect(oneInN(0)).toBeNull();
    expect(oneInN(null)).toBeNull();
  });

  it('never divides by zero', () => {
    expect(safeRatio(10, 0)).toBeNull();
  });
});

describe('integrity checks', () => {
  const counts = { delivered: 230, cancelled: 62, rts: 116 };

  it('passes on consistent inputs', () => {
    const rates = resolvedRates(counts);
    const checks = runIntegrityChecks({
      counts, rates, rawOrders: 472, bucketValueSum: 1_000_000, totalOrderValue: 1_000_000,
    });
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it('fails when resolved orders exceed orders placed', () => {
    const rates = resolvedRates(counts);
    const checks = runIntegrityChecks({
      counts, rates, rawOrders: 10, bucketValueSum: 1_000_000, totalOrderValue: 1_000_000,
    });
    expect(checks.find((check) => check.code === 'RESOLVED_WITHIN_ORDERS')?.passed).toBe(false);
  });

  it('fails when bucket values do not reconcile to the total', () => {
    const rates = resolvedRates(counts);
    const checks = runIntegrityChecks({
      counts, rates, rawOrders: 472, bucketValueSum: 500_000, totalOrderValue: 1_000_000,
    });
    expect(checks.find((check) => check.code === 'BUCKET_VALUE_SUM')?.passed).toBe(false);
  });
});
