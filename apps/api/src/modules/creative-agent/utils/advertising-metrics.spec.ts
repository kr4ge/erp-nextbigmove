import { describe, expect, it } from '@jest/globals';
import {
  adSpendRatio,
  clickThroughRate,
  codCeiling,
  completionRate,
  conversionRate,
  costPerClick,
  costPerOrder,
  cppHeadroom,
  deliveredCostPerOrder,
  holdRate,
  hookRate,
  landingPageRate,
  netContribution,
  resolvedRates,
} from './advertising-metrics';

describe('advertising metric helpers', () => {
  it('partitions resolved orders into three rates that sum to exactly 1', () => {
    const rates = resolvedRates(60, 30, 10);
    expect(rates.resolved).toBe(100);
    expect(rates.deliveryRate).toBe(0.6);
    expect(rates.cancellationRate).toBe(0.3);
    expect(rates.rtsRate).toBe(0.1);
    expect(
      (rates.deliveryRate as number) + (rates.cancellationRate as number) + (rates.rtsRate as number),
    ).toBeCloseTo(1, 9);
  });

  it('returns null rates when nothing is resolved', () => {
    const rates = resolvedRates(0, 0, 0);
    expect(rates.resolved).toBe(0);
    expect(rates.deliveryRate).toBeNull();
    expect(rates.cancellationRate).toBeNull();
    expect(rates.rtsRate).toBeNull();
  });

  it('cost ratios return null on zero denominators, never 0', () => {
    expect(costPerClick(500, 0)).toBeNull();
    expect(costPerOrder(500, 0)).toBeNull();
    expect(deliveredCostPerOrder(500, 0)).toBeNull();
    expect(adSpendRatio(500, 0)).toBeNull();
  });

  it('ad spend ratio may legitimately exceed 1 and is not withheld', () => {
    expect(adSpendRatio(1102, 1000)).toBe(1.102);
  });

  it('funnel rates are withheld when they exceed 1', () => {
    expect(hookRate(251, 100)).toBeNull();
    expect(holdRate(120, 100)).toBeNull();
    expect(completionRate(150, 100)).toBeNull();
    expect(clickThroughRate(200, 100)).toBeNull();
    expect(landingPageRate(120, 100)).toBeNull();
    expect(conversionRate(30, 10)).toBeNull();
  });

  it('CVR uses landing-page views and is null without them — never clicks', () => {
    expect(conversionRate(10, 200)).toBe(0.05);
    expect(conversionRate(10, 0)).toBeNull();
  });

  it('static creatives yield null video rates (measured denominators are zero)', () => {
    // impressions > 0 but no measured 3s plays / ThruPlays → denominators are 0
    expect(hookRate(0, 0)).toBeNull();
    expect(holdRate(0, 0)).toBeNull();
    expect(completionRate(0, 0)).toBeNull();
    // graded on the click instead
    expect(clickThroughRate(25, 1000)).toBe(0.025);
  });

  it('computes reconciled net contribution with the ERP P&L shape', () => {
    expect(netContribution({ deliveredRevenue: 10000, deliveredCogs: 3000, fulfillmentCosts: 2000, spend: 4000 })).toBe(1000);
    expect(netContribution({ deliveredRevenue: 1000, deliveredCogs: 600, fulfillmentCosts: 300, spend: 500 })).toBe(-400);
  });

  it('prefers a configured target CPP over the computed break-even', () => {
    const ceiling = codCeiling({
      deliveredRevenue: 10000, deliveredCogs: 3000, fulfillmentCosts: 1000, deliveredCount: 10,
      deliveryRate: 0.6, rtsRate: 0.1, rtsCostPerRtsOrder: 100,
      configuredTargetCpp: 450,
    });
    expect(ceiling.workingCeiling).toBe(450);
    expect(ceiling.provisional).toBe(false);
    expect(ceiling.marginPerDeliveredOrder).toBe(600);
    expect(ceiling.breakevenCpp).toBe(350); // 0.6×600 − 0.1×100
  });

  it('falls back to break-even × (1 − safety margin) and flags provisional', () => {
    const ceiling = codCeiling({
      deliveredRevenue: 10000, deliveredCogs: 3000, fulfillmentCosts: 1000, deliveredCount: 10,
      deliveryRate: 0.6, rtsRate: 0.1, rtsCostPerRtsOrder: 100,
      configuredTargetCpp: null, safetyMargin: 0.2,
    });
    expect(ceiling.breakevenCpp).toBe(350);
    expect(ceiling.workingCeiling).toBe(280);
    expect(ceiling.provisional).toBe(true);
  });

  it('degrades gracefully when the RTS cost source is missing', () => {
    const ceiling = codCeiling({
      deliveredRevenue: 10000, deliveredCogs: 3000, fulfillmentCosts: 1000, deliveredCount: 10,
      deliveryRate: 0.6, rtsRate: 0.1, rtsCostPerRtsOrder: null,
      configuredTargetCpp: null, safetyMargin: 0.2,
    });
    expect(ceiling.breakevenCpp).toBe(360); // RTS term dropped, not invented
    expect(ceiling.provisional).toBe(true);
  });

  it('returns no ceiling when nothing has delivered', () => {
    const ceiling = codCeiling({
      deliveredRevenue: 0, deliveredCogs: 0, fulfillmentCosts: 0, deliveredCount: 0,
      deliveryRate: null, rtsRate: null, rtsCostPerRtsOrder: null,
      configuredTargetCpp: null,
    });
    expect(ceiling.marginPerDeliveredOrder).toBeNull();
    expect(ceiling.breakevenCpp).toBeNull();
    expect(ceiling.workingCeiling).toBeNull();
  });

  it('computes CPP headroom against the break-even, null when unusable', () => {
    expect(cppHeadroom(300, 600)).toBe(0.5);
    expect(cppHeadroom(600, 300)).toBe(-1);
    expect(cppHeadroom(null, 600)).toBeNull();
    expect(cppHeadroom(300, null)).toBeNull();
    expect(cppHeadroom(300, 0)).toBeNull();
  });
});
