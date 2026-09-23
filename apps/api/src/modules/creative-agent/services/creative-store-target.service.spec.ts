import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import {
  BAND_RATIOS,
  CreativeStoreTargetService,
  assertBandOrder,
  renderStoreTargets,
  resolveBands,
  storeTargetVariables,
  type StoreTargetValues,
} from './creative-store-target.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const storeConfigId = '44444444-4444-4444-8444-444444444444';
const actor = { userId, tenantId } as any;

const dec = (value: number) => new Prisma.Decimal(value);

const values = (overrides: Partial<StoreTargetValues> = {}): StoreTargetValues => ({
  hookRatePct: null, holdRatePct: null, ctrPct: null,
  breakevenCpp: null, cpp: null, scaleCpp: null, killCpp: null,
  arPct: null, scaleArPct: null, killArPct: null,
  maxCancellationPct: null, maxRtsPct: null, note: null,
  ...overrides,
});

function setup(options: { store?: any; target?: any } = {}) {
  const permissions = ['creative_agent.read', 'creative_agent.performance.manage'];
  const context = { tenantId, userId, isSuperAdmin: false, permissions: new Set(permissions) };
  const prisma: any = {
    creativeStoreConfig: {
      findFirst: jest.fn(async () => (options.store === undefined ? { id: storeConfigId, storeId: 'pos-1', storeNameSnapshot: 'Ogimi Wellness', target: options.target ?? null } : options.store)),
      findMany: jest.fn(async () => []),
    },
    creativeStoreTarget: {
      findFirst: jest.fn(async () => options.target ?? null),
      upsert: jest.fn(async (args: any) => ({ id: 'tgt-1', ...args.create, updatedAt: new Date(), updatedBy: null })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const access = {
    resolve: jest.fn(async () => context),
    require: jest.fn((_ctx: any, ...required: string[]) => {
      if (!required.some((permission) => permissions.includes(permission))) throw new Error('Insufficient permissions');
    }),
  };
  return { service: new CreativeStoreTargetService(prisma, access as any), prisma };
}

describe('renderStoreTargets', () => {
  it('says every value is not set when the store has none', () => {
    // The prompt reads this in words, which is what makes it return
    // NO_THRESHOLDS instead of guessing a number.
    const text = renderStoreTargets('Ogimi Wellness', null);
    expect(text).toMatch(/has no target KPIs set yet/);
    expect(text).toContain('CPP target: not set');
    expect(text).toContain('CPP kill above: not set');
  });

  it('names each band for what it decides, so a target is never read as a ceiling', () => {
    const text = renderStoreTargets('Ogimi Wellness', values({
      breakevenCpp: 520, cpp: 300, scaleCpp: 220, killCpp: 390,
      arPct: 33, scaleArPct: 24, killArPct: 43,
      hookRatePct: 50, maxCancellationPct: 10, note: 'Payday weeks run hotter.',
    }));
    expect(text).toContain('CPP break-even: ₱520 (where an order stops making money; never an ambition)');
    expect(text).toContain('CPP target: ₱300 (the ambition; at or below this the creative is working)');
    expect(text).toContain('CPP scale below: ₱220');
    expect(text).toContain('CPP kill above: ₱390');
    expect(text).toContain('AR% target: 33%');
    expect(text).toContain('Minimum hook rate: 50% (a floor: above it is good, below it is a weakness to explain)');
    expect(text).toContain('Note from the store: Payday weeks run hotter.');
  });

  it('gives AR% no break-even line, because there is nothing to derive it from', () => {
    expect(renderStoreTargets('Ogimi', values({ arPct: 33 }))).not.toContain('AR% break-even');
  });

  it('derives the scale and kill lines from the target and says it derived them', () => {
    // The form asks for one number per metric; the model still judges bands.
    const text = renderStoreTargets('Ogimi', values({ cpp: 300 }));
    expect(text).toContain('CPP scale below: ₱225');
    expect(text).toContain('derived as 75% of the target');
    expect(text).toContain('CPP kill above: ₱390');
    expect(text).toContain('derived as 130% of the target');
  });

  it('never claims a line was derived when the store named it', () => {
    const text = renderStoreTargets('Ogimi', values({ cpp: 300, scaleCpp: 200, killCpp: 500 }));
    expect(text).toContain('CPP scale below: ₱200');
    expect(text).not.toContain('derived as 75%');
  });

  it('tells the model what to compare hold rate and CTR against, since no store figure exists', () => {
    expect(renderStoreTargets('Ogimi', values({ hookRatePct: 50 }))).toMatch(/Hold rate and link CTR have no store figure/);
  });
});

describe('resolveBands', () => {
  it('returns the store\'s own lines untouched', () => {
    expect(resolveBands(300, 200, 500)).toMatchObject({ scale: 200, kill: 500, scaleDerived: false, killDerived: false });
  });

  it('derives what is missing, and nothing at all without a target', () => {
    expect(resolveBands(300, null, null)).toMatchObject({ scale: 225, kill: 390, scaleDerived: true, killDerived: true });
    expect(resolveBands(null, null, null)).toMatchObject({ scale: null, kill: null, scaleDerived: false });
    expect(BAND_RATIOS).toEqual({ scale: 0.75, kill: 1.3 });
  });
});

describe('storeTargetVariables', () => {
  it('fills every band variable, with "not set" for gaps', () => {
    expect(storeTargetVariables(null)).toMatchObject({ TARGET_CPP: 'not set', SCALE_CPP: 'not set', KILL_CPP: 'not set', BREAKEVEN_CPP: 'not set' });
    const filled = storeTargetVariables(values({ breakevenCpp: 520, cpp: 300, scaleCpp: 220, killCpp: 390, arPct: 33, scaleArPct: 24, killArPct: 43, hookRatePct: 50 }));
    expect(filled).toMatchObject({
      BREAKEVEN_CPP: '₱520', TARGET_CPP: '₱300', SCALE_CPP: '₱220', KILL_CPP: '₱390',
      TARGET_AR_PCT: '33%', SCALE_AR_PCT: '24%', KILL_AR_PCT: '43%', TARGET_HOOK_RATE: '50%',
    });
  });

  it('supplies derived lines when the store set only the targets', () => {
    // The prompt must never see "not set" for a line it needs to decide with.
    expect(storeTargetVariables(values({ cpp: 300, arPct: 40 }))).toMatchObject({
      SCALE_CPP: '₱225', KILL_CPP: '₱390', SCALE_AR_PCT: '30%', KILL_AR_PCT: '52%',
    });
  });
});

describe('assertBandOrder', () => {
  it('accepts bands in order, and any combination with gaps', () => {
    expect(() => assertBandOrder({ scaleCpp: 220, cpp: 300, killCpp: 390, breakevenCpp: 520 })).not.toThrow();
    expect(() => assertBandOrder({ cpp: 300 })).not.toThrow();
    expect(() => assertBandOrder({})).not.toThrow();
  });

  it('refuses a scale line above the target', () => {
    // Scaling above the target would recommend budget for a creative that is
    // only just working.
    expect(() => assertBandOrder({ scaleCpp: 350, cpp: 300 })).toThrow(BadRequestException);
  });

  it('refuses a kill line below the target, and a target above break-even', () => {
    expect(() => assertBandOrder({ cpp: 300, killCpp: 250 })).toThrow(/Target CPP must be at or below Kill above CPP/);
    expect(() => assertBandOrder({ cpp: 600, breakevenCpp: 520 })).toThrow(/Target CPP must be at or below Break-even CPP/);
  });

  it('applies the same order to AR%', () => {
    expect(() => assertBandOrder({ scaleArPct: 40, arPct: 33 })).toThrow(BadRequestException);
    expect(() => assertBandOrder({ arPct: 33, killArPct: 30 })).toThrow(BadRequestException);
  });
});

describe('CreativeStoreTargetService', () => {
  it('treats a row with every value blank as no targets at all', async () => {
    const { service } = setup({ target: { hookRatePct: null, cpp: null, breakevenCpp: null, note: 'later' } });
    expect(await service.forStore(tenantId, storeConfigId)).toBeNull();
  });

  it('returns numbers, not decimals, for the prompt', async () => {
    const { service } = setup({ target: { breakevenCpp: dec(520), cpp: dec(300), scaleCpp: dec(220), killCpp: dec(390), arPct: dec(33), holdRatePct: null } });
    expect(await service.forStore(tenantId, storeConfigId)).toMatchObject({ breakevenCpp: 520, cpp: 300, scaleCpp: 220, killCpp: 390, arPct: 33, holdRatePct: null });
  });

  it('stores blanks as null and records the change', async () => {
    const { service, prisma } = setup();
    const saved = await service.upsert(actor, storeConfigId, { cpp: 300, scaleCpp: 220, killCpp: 390, note: '  ' } as any);
    const written = prisma.creativeStoreTarget.upsert.mock.calls[0][0].create;
    expect(Number(written.cpp)).toBe(300);
    expect(Number(written.killCpp)).toBe(390);
    expect(written.hookRatePct).toBeNull();
    expect(written.note).toBeNull();
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(saved.isSet).toBe(true);
  });

  it('refuses to save bands that contradict each other', async () => {
    const { service, prisma } = setup();
    await expect(service.upsert(actor, storeConfigId, { cpp: 300, killCpp: 200 } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.creativeStoreTarget.upsert).not.toHaveBeenCalled();
  });

  it('refuses a store from another tenant', async () => {
    const { service } = setup({ store: null });
    await expect(service.upsert(actor, storeConfigId, { cpp: 1 } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
