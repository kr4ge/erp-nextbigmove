import { describe, expect, it } from '@jest/globals';
import { CreativeKind } from '@prisma/client';
import {
  bandScore,
  craftVerdict,
  creativeCScore,
  creativeVerdict,
  C_SCORE_STATIC_WEIGHTS,
  C_SCORE_WEIGHTS,
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
    expect(scorecardVerdict(2)).toMatch(/Below target/);
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

  describe('creativeCScore', () => {
    const video = {
      kind: CreativeKind.VIDEO,
      arCeiling: 0.3,
      storeMedianCvr: null,
      cvr: null,
    };

    it('separates a proven winner from a money-loser', () => {
      // The Test Brand fixtures: TB-V0001 the winner, TB-V0002 the loser.
      const winner = creativeCScore({
        ...video, arPct: 0.288, orders: 42, spend: 44_000,
        hookRate: 0.297, holdRate: 0.421, ctr: 0.019,
      });
      const loser = creativeCScore({
        ...video, arPct: 0.62, orders: 3, spend: 33_500,
        hookRate: 0.157, holdRate: 0.268, ctr: 0.015,
      });
      expect(winner).toBeCloseTo(8.5, 0);
      expect(loser).toBeCloseTo(4.0, 0);
      // The loser's CTR is on target — money is what separates them, which is
      // exactly what the old craft-only score could not see.
      expect((winner as number) - (loser as number)).toBeGreaterThan(4);
    });

    it('only credits spend that held at or under the AR% ceiling', () => {
      const at29 = creativeCScore({ ...video, arPct: 0.29, orders: 12, spend: 40_000, hookRate: null, holdRate: null, ctr: null });
      const at31 = creativeCScore({ ...video, arPct: 0.31, orders: 12, spend: 40_000, hookRate: null, holdRate: null, ctr: null });
      // Same spend, but only the held one earns the proven-spend band; over the
      // ceiling that weight folds into AR% instead.
      expect(at29 as number).toBeGreaterThan(at31 as number);
    });

    it('grades a static on money plus click and conversion', () => {
      const image = creativeCScore({
        kind: CreativeKind.STATIC, arCeiling: 0.3, storeMedianCvr: 0.08,
        arPct: 0.25, orders: 15, spend: 25_000,
        hookRate: null, holdRate: null, ctr: 0.02, cvr: 0.08,
      });
      expect(image).not.toBeNull();
      expect(image as number).toBeGreaterThan(7);
    });

    it('hands the hook and hold weight to a static CTR and CVR, not to money', () => {
      // Both kinds must land on the same 60/40 money-to-craft balance, or an
      // image ends up graded almost entirely on economics.
      const money = C_SCORE_WEIGHTS.arPct + C_SCORE_WEIGHTS.orders + C_SCORE_WEIGHTS.provenSpend;
      const videoCraft = C_SCORE_WEIGHTS.hookRate + C_SCORE_WEIGHTS.holdRate + C_SCORE_WEIGHTS.ctr + C_SCORE_WEIGHTS.cvr;
      const staticCraft = C_SCORE_STATIC_WEIGHTS.ctr + C_SCORE_STATIC_WEIGHTS.cvr;
      expect(money).toBeCloseTo(0.6);
      expect(videoCraft).toBeCloseTo(0.4);
      expect(staticCraft).toBeCloseTo(0.4);
    });

    it('lets a static craft failure actually move the score', () => {
      const money = {
        kind: CreativeKind.STATIC, arCeiling: 0.3, storeMedianCvr: 0.05,
        arPct: 0.25, orders: 15, spend: 25_000, hookRate: null, holdRate: null,
      };
      const strongCraft = creativeCScore({ ...money, ctr: 0.03, cvr: 0.1 }) as number;
      const weakCraft = creativeCScore({ ...money, ctr: 0.005, cvr: 0.01 }) as number;
      // Identical economics; only the click and the conversion differ. Under
      // plain renormalization this gap was far narrower.
      expect(strongCraft - weakCraft).toBeGreaterThan(2.5);
    });

    it('scores spend against zero net sales as burned money, not missing data', () => {
      const burned = creativeCScore({ ...video, arPct: null, orders: 0, spend: 10_000, hookRate: 0.3, holdRate: 0.35, ctr: 0.02 });
      // Strong craft cannot rescue a creative that sold nothing.
      expect(burned as number).toBeLessThan(4);
    });

    it('returns null when nothing ever ran', () => {
      expect(creativeCScore({ ...video, arPct: null, orders: 0, spend: 0, hookRate: null, holdRate: null, ctr: null })).toBeNull();
    });

    it('floors the CVR bar so a broken store cannot grade itself against a broken median', () => {
      const vsLowMedian = creativeCScore({ ...video, storeMedianCvr: 0.01, cvr: 0.02, arPct: 0.25, orders: 12, spend: 25_000, hookRate: null, holdRate: null, ctr: null });
      const vsFloor = creativeCScore({ ...video, storeMedianCvr: null, cvr: 0.02, arPct: 0.25, orders: 12, spend: 25_000, hookRate: null, holdRate: null, ctr: null });
      // A 1% median must not turn a 2% CVR into a perfect band; both grade
      // against the 5% floor.
      expect(vsLowMedian).toEqual(vsFloor);
    });
  });

  describe('creativeVerdict', () => {
    const base = {
      testing: false, arCeiling: 0.3, killLine: 0.5,
      fatiguing: false, bottleneck: null as string | null,
    };

    it('withholds a verdict until there is evidence', () => {
      const out = creativeVerdict({ ...base, testing: true, orders: 1, spend: 400, arPct: 0.2 });
      expect(out.verdict).toBe('TESTING');
      expect(out.reason).toMatch(/Not enough evidence/);
    });

    it('scales a winner that is not fatiguing', () => {
      const out = creativeVerdict({ ...base, orders: 42, spend: 44_000, arPct: 0.288 });
      expect(out.verdict).toBe('SCALE');
      expect(out.reason).toMatch(/42 orders at 28.8% AR%/);
    });

    it('refreshes a winner that is fatiguing rather than scaling it', () => {
      const out = creativeVerdict({ ...base, orders: 42, spend: 44_000, arPct: 0.288, fatiguing: true });
      expect(out.verdict).toBe('REFRESH');
      expect(out.reason).toMatch(/proven/);
    });

    it('kills past the kill line and names the broken step', () => {
      const out = creativeVerdict({ ...base, orders: 3, spend: 33_500, arPct: 0.62, bottleneck: 'HOOK' });
      expect(out.verdict).toBe('KILL');
      expect(out.reason).toMatch(/Hook is under target/);
    });

    it('blames the offer, not the cut, when the money fails on a clean funnel', () => {
      const out = creativeVerdict({ ...base, orders: 4, spend: 33_500, arPct: 0.62 });
      expect(out.verdict).toBe('KILL');
      // The one pairing that must never send someone off to re-shoot.
      expect(out.reason).toMatch(/leak is after the click/);
    });

    it('kills money spent with nothing sold back', () => {
      expect(creativeVerdict({ ...base, orders: 0, spend: 12_000, arPct: null }).verdict).toBe('KILL');
      expect(creativeVerdict({ ...base, orders: 0, spend: 12_000, arPct: 0.4 }).reason).toMatch(/not one order/);
    });

    it('refreshes the drift between the ceiling and the kill line', () => {
      const drifted = creativeVerdict({ ...base, orders: 19, spend: 19_500, arPct: 0.361 });
      expect(drifted.verdict).toBe('REFRESH');
      expect(drifted.reason).toMatch(/drifted past the 30.0% ceiling/);

      const broken = creativeVerdict({ ...base, orders: 19, spend: 19_500, arPct: 0.361, bottleneck: 'HOOK' });
      expect(broken.verdict).toBe('REFRESH');
      expect(broken.reason).toMatch(/Hook is the first step under target/);
    });

    it('refreshes an efficient creative that is short of the order bar', () => {
      const out = creativeVerdict({ ...base, orders: 4, spend: 5_000, arPct: 0.2 });
      expect(out.verdict).toBe('REFRESH');
      expect(out.reason).toMatch(/short of the 10-order bar/);
    });
  });
});