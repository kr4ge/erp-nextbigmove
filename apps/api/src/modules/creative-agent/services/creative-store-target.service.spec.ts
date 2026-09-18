import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { CreativeStoreTargetService, renderStoreTargets, storeTargetVariables } from './creative-store-target.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const storeConfigId = '44444444-4444-4444-8444-444444444444';
const actor = { userId, tenantId } as any;

const dec = (value: number) => new Prisma.Decimal(value);

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
  it('says every target is not set when the store has none', () => {
    // The prompt reads this in words, which is what makes it return
    // NO_THRESHOLDS instead of guessing a number.
    const text = renderStoreTargets('Ogimi Wellness', null);
    expect(text).toMatch(/has no target KPIs set yet/);
    expect(text).toMatch(/Target CPP: not set/);
  });

  it('renders money and percentages the way the prompt expects', () => {
    const text = renderStoreTargets('Ogimi Wellness', {
      hookRatePct: 25, holdRatePct: null, ctrPct: 1.5, cpp: 350, arPct: 40, maxCancellationPct: 15, maxRtsPct: 20, note: 'Payday weeks run hotter.',
    });
    expect(text).toContain('Target CPP: ₱350');
    expect(text).toContain('Target AR%: 40%');
    expect(text).toContain('Hold rate benchmark: not set');
    expect(text).toContain('Link CTR benchmark: 1.5%');
    expect(text).toContain('Note from the store: Payday weeks run hotter.');
  });
});

describe('storeTargetVariables', () => {
  it('fills every individual variable, with "not set" for gaps and for a missing store target', () => {
    expect(storeTargetVariables(null)).toMatchObject({ TARGET_CPP: 'not set', MAX_RTS_RATE: 'not set', TARGET_HOOK_RATE: 'not set' });
    const filled = storeTargetVariables({ hookRatePct: 25, holdRatePct: 40, ctrPct: 2, cpp: 350, arPct: 40, maxCancellationPct: 15, maxRtsPct: 20, note: null });
    expect(filled).toEqual({
      TARGET_HOOK_RATE: '25%', TARGET_HOLD_RATE: '40%', TARGET_CTR: '2%', TARGET_AR_PCT: '40%', TARGET_CPP: '₱350', MAX_CANCELLATION_RATE: '15%', MAX_RTS_RATE: '20%',
    });
  });
});

describe('CreativeStoreTargetService', () => {
  it('treats a row with every value blank as no targets at all', async () => {
    const { service } = setup({ target: { hookRatePct: null, holdRatePct: null, ctrPct: null, cpp: null, arPct: null, maxCancellationPct: null, maxRtsPct: null, note: 'later' } });
    expect(await service.forStore(tenantId, storeConfigId)).toBeNull();
  });

  it('returns numbers, not decimals, for the prompt', async () => {
    const { service } = setup({ target: { hookRatePct: dec(25), holdRatePct: null, ctrPct: null, cpp: dec(350), arPct: dec(40), maxCancellationPct: null, maxRtsPct: null, note: null } });
    expect(await service.forStore(tenantId, storeConfigId)).toMatchObject({ hookRatePct: 25, cpp: 350, arPct: 40, holdRatePct: null });
  });

  it('stores blanks as null and records the change', async () => {
    const { service, prisma } = setup();
    const saved = await service.upsert(actor, storeConfigId, { cpp: 350, arPct: 40, note: '  ' } as any);
    const written = prisma.creativeStoreTarget.upsert.mock.calls[0][0].create;
    expect(Number(written.cpp)).toBe(350);
    expect(written.hookRatePct).toBeNull();
    expect(written.note).toBeNull();
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(saved.isSet).toBe(true);
  });

  it('refuses a store from another tenant', async () => {
    const { service } = setup({ store: null });
    await expect(service.upsert(actor, storeConfigId, { cpp: 1 } as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
