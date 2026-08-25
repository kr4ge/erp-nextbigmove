import { describe, expect, it } from '@jest/globals';
import { CreativeKind } from '@prisma/client';
import {
  bandScore,
  craftVerdict,
  CREATIVE_CRAFT_FLOORS,
  guardedRatio,
  isImpossibleRate,
  median,
  safeRatio,
  scorecardVerdict,
  weightedBandScore,
} from './creative-metrics';

describe('creative metric helpers', () => {
  it('returns null for a zero denominator instead of 0', () => {
    expect(safeRatio(5, 0)).toBeNull();
    expect(guardedRatio(5, 0)).toBeNull();
  });

  it('withholds impossible rates above 1.0', () => {
    expect(isImpossibleRate(251, 100)).toBe(true);
    expect(guardedRatio(251, 100)).toBeNull();
    expect(guardedRatio(100, 100)).toBe(1);
  });

  it('computes weighted aggregate ratios', () => {
    expect(safeRatio(30, 100)).toBe(0.3);
  });

  it('computes the median with even and odd counts', () => {
    expect(median([])).toBeNull();
    expect(median([4])).toBe(4);
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('band scoring meets the bar at 7 and caps at 10', () => {
    expect(bandScore(0.3, 0.3)).toBe(7);
    expect(bandScore(0.45, 0.3)).toBe(10);
    expect(bandScore(0.6, 0.3)).toBe(10);
    expect(bandScore(0.15, 0.3)).toBe(3.5);
    expect(bandScore(null, 0.3)).toBeNull();
  });

  it('reweights missing bands instead of zeroing them', () => {
    expect(weightedBandScore([
      { score: 8, weight: 3 },
      { score: null, weight: 2 },
      { score: 6, weight: 1 },
    ])).toBe(7.5);
    expect(weightedBandScore([{ score: null, weight: 3 }])).toBeNull();
  });

  it('clamps the overall score to 1…10', () => {
    expect(weightedBandScore([{ score: 0, weight: 1 }])).toBe(1);
  });

  it('maps overall score to a verdict sentence', () => {
    expect(scorecardVerdict(9.2)).toMatch(/Outstanding/);
    expect(scorecardVerdict(7.6)).toMatch(/Strong/);
    expect(scorecardVerdict(6.5)).toMatch(/Solid/);
    expect(scorecardVerdict(4.5)).toMatch(/Mixed/);
    expect(scorecardVerdict(2)).toMatch(/Below the bar/);
    expect(scorecardVerdict(null)).toBeNull();
  });

  const base = {
    hookRate: null, holdRate: null, completionRate: null,
    ctr: null, cancellationRate: null, fatiguing: false,
  };

  it('retires videos below the kill lines, first match wins', () => {
    expect(craftVerdict(CreativeKind.VIDEO, { ...base, hookRate: 0.2 }).verdict).toBe('RETIRE');
    expect(craftVerdict(CreativeKind.VIDEO, { ...base, hookRate: 0.35, completionRate: 0.05 }).verdict).toBe('RETIRE');
    expect(craftVerdict(CreativeKind.VIDEO, { ...base, hookRate: 0.35, completionRate: 0.12, cancellationRate: 0.4 }).verdict).toBe('RETIRE');
  });

  it('scales videos at or above hook and hold floors unless fatiguing', () => {
    const healthy = { ...base, hookRate: 0.35, holdRate: 0.3, completionRate: 0.12, cancellationRate: 0.1 };
    expect(craftVerdict(CreativeKind.VIDEO, healthy).verdict).toBe('SCALE');
    expect(craftVerdict(CreativeKind.VIDEO, { ...healthy, fatiguing: true }).verdict).toBe('REFRESH');
  });

  it('grades statics on the click, never on video floors', () => {
    expect(craftVerdict(CreativeKind.STATIC, { ...base, ctr: 0.025 }).verdict).toBe('SCALE');
    expect(craftVerdict(CreativeKind.STATIC, { ...base, ctr: 0.01 }).verdict).toBe('RETIRE');
    expect(craftVerdict(CreativeKind.STATIC, { ...base, ctr: 0.018 }).verdict).toBe('REFRESH');
    expect(craftVerdict(CreativeKind.STATIC, { ...base, ctr: 0.025, cancellationRate: 0.4 }).verdict).toBe('RETIRE');
  });

  it('keeps the kill lines derived from the floors', () => {
    expect(CREATIVE_CRAFT_FLOORS.hookRate * 0.8).toBeCloseTo(0.24);
    expect(CREATIVE_CRAFT_FLOORS.cancellationRate * 1.25).toBeCloseTo(0.3125);
  });
});
