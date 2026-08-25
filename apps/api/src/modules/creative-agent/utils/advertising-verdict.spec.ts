import { describe, expect, it } from '@jest/globals';
import { advertisingVerdict, type AdvertisingVerdictInput } from './advertising-verdict';

const base: AdvertisingVerdictInput = {
  spend: 0,
  orders: 0,
  cpp: null,
  ceiling: 500,
  ctr: null,
  benchmarkCtr: 0.02,
  cancellationRate: null,
  maxCancellationRate: 0.25,
  netContribution: null,
  attributionCoverage: null,
  minAttributionCoverage: 0.7,
};

describe('advertising verdict ladder', () => {
  it('suppresses the verdict entirely below the attribution-coverage minimum', () => {
    const verdict = advertisingVerdict({ ...base, spend: 5000, orders: 20, cpp: 250, attributionCoverage: 0.2 });
    expect(verdict.suppressed).toBe(true);
    expect(verdict.verdict).toBeNull();
    expect(verdict.decided).toBe(false);
    expect(verdict.needsAction).toBe(false);
  });

  it('does not suppress at or above the coverage minimum', () => {
    const verdict = advertisingVerdict({ ...base, spend: 1000, orders: 4, cpp: 250, attributionCoverage: 0.7 });
    expect(verdict.suppressed).toBe(false);
  });

  describe('zero POS orders', () => {
    it('missing ceiling → undecided watch', () => {
      const verdict = advertisingVerdict({ ...base, spend: 3000, ceiling: null });
      expect(verdict).toMatchObject({ verdict: 'WATCH', decided: false, needsAction: false });
    });

    it('spend at 2× ceiling → decided kill', () => {
      const verdict = advertisingVerdict({ ...base, spend: 1000, ceiling: 500 });
      expect(verdict).toMatchObject({ verdict: 'KILL', decided: true, needsAction: true });
    });

    it('spend under one ceiling → too early, undecided', () => {
      const verdict = advertisingVerdict({ ...base, spend: 300, ceiling: 500 });
      expect(verdict).toMatchObject({ verdict: 'WATCH', decided: false, needsAction: false });
      expect(verdict.reason).toMatch(/Too early/);
    });

    it('CTR at benchmark between 1× and 2× ceiling → watch, leak after the click', () => {
      const verdict = advertisingVerdict({ ...base, spend: 700, ceiling: 500, ctr: 0.02 });
      expect(verdict).toMatchObject({ verdict: 'WATCH', decided: true, needsAction: true });
      expect(verdict.reason).toMatch(/after the click/);
    });

    it('otherwise → kill', () => {
      const verdict = advertisingVerdict({ ...base, spend: 700, ceiling: 500, ctr: 0.01 });
      expect(verdict).toMatchObject({ verdict: 'KILL', decided: true, needsAction: true });
    });

    it('null CTR falls through to kill, never to the benchmark branch', () => {
      const verdict = advertisingVerdict({ ...base, spend: 700, ceiling: 500, ctr: null });
      expect(verdict.verdict).toBe('KILL');
    });
  });

  describe('POS orders present', () => {
    const withOrders: AdvertisingVerdictInput = { ...base, spend: 2000, orders: 8, cpp: 250 };

    it('missing ceiling → undecided watch', () => {
      const verdict = advertisingVerdict({ ...withOrders, ceiling: null });
      expect(verdict).toMatchObject({ verdict: 'WATCH', decided: false });
    });

    it('missing CPP → undecided watch', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: null });
      expect(verdict).toMatchObject({ verdict: 'WATCH', decided: false });
    });

    it('CPP above 1.5× ceiling → kill', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: 751, ceiling: 500 });
      expect(verdict).toMatchObject({ verdict: 'KILL', decided: true, needsAction: true });
    });

    it('cancellation above the maximum → watch routed to confirmation', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: 400, cancellationRate: 0.4 });
      expect(verdict).toMatchObject({ verdict: 'WATCH', needsAction: true, route: 'CONFIRMATION' });
    });

    it('CPP above ceiling but under kill line → watch', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: 600, ceiling: 500 });
      expect(verdict).toMatchObject({ verdict: 'WATCH', decided: true, needsAction: true, route: null });
    });

    it('negative net contribution → watch routed to fulfillment', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: 400, netContribution: -1200 });
      expect(verdict).toMatchObject({ verdict: 'WATCH', needsAction: true, route: 'FULFILLMENT' });
    });

    it('otherwise → scale, no action needed', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: 400, netContribution: 3500, cancellationRate: 0.1 });
      expect(verdict).toMatchObject({ verdict: 'SCALE', decided: true, needsAction: false });
    });

    it('cancellation check outranks the plain over-ceiling check (first match wins)', () => {
      const verdict = advertisingVerdict({ ...withOrders, cpp: 600, ceiling: 500, cancellationRate: 0.4 });
      expect(verdict.route).toBe('CONFIRMATION');
    });
  });

  it('every reason is a quantified sentence', () => {
    const samples = [
      advertisingVerdict({ ...base, spend: 1000 }),
      advertisingVerdict({ ...base, spend: 300 }),
      advertisingVerdict({ ...base, spend: 2000, orders: 4, cpp: 900 }),
      advertisingVerdict({ ...base, spend: 2000, orders: 4, cpp: 400, netContribution: 500 }),
    ];
    for (const sample of samples) {
      expect(sample.reason.length).toBeGreaterThan(20);
    }
  });
});
