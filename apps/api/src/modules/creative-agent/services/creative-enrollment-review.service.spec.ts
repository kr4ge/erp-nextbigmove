import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { CreativeEnrollmentReviewService } from './creative-enrollment-review.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const creativeId = '33333333-3333-4333-8333-333333333333';
const reviewId = '55555555-5555-4555-8555-555555555555';

function setup(options: { review?: Record<string, unknown> | null; permissions?: string[] } = {}) {
  const permissions = options.permissions ?? [
    'creative_agent.read',
    'creative_agent.review',
    'creative_agent.ai.use',
  ];
  const context = { tenantId, userId, isSuperAdmin: false, permissions: new Set(permissions) };
  const prisma: any = {
    creativeEnrollmentReview: {
      findFirst: jest.fn(async () => (options.review === undefined ? null : options.review)),
      update: jest.fn(async (args: any) => ({ id: reviewId, ...args.data })),
      create: jest.fn(async (args: any) => ({ id: reviewId, ...args.data })),
      groupBy: jest.fn(async () => []),
    },
    creative: {
      findFirst: jest.fn(async () => ({
        id: creativeId,
        code: 'ABC-V0001',
        storeConfigId: 'store-1',
        storeConfig: { id: 'store-1', storeNameSnapshot: 'Dear Scent', aiNiche: 'FRAGRANCE_BEAUTY', aiStoreRules: null },
      })),
    },
    creativeAiRun: { findFirst: jest.fn(async () => ({ id: 'run-1', status: 'COMPLETED' })) },
  };
  const access = {
    resolve: jest.fn(async () => context),
    require: jest.fn((_ctx: any, ...required: string[]) => {
      if (!required.some((permission) => permissions.includes(permission))) {
        throw new Error('Insufficient permissions');
      }
    }),
  };
  const knowledge = { corpusForStore: jest.fn(async () => [] as any[]) };
  const claudebox = { run: jest.fn() };
  const queue = { add: jest.fn(async () => ({ id: 'job-1' })) };
  const promptContext = { build: jest.fn(async () => ({ mode: 'NEW_REVIEWER', promptVersion: 1, prompt: 'p', schema: {}, modeNote: 'n' })) };
  const service = new CreativeEnrollmentReviewService(
    prisma,
    access as any,
    knowledge as any,
    claudebox as any,
    promptContext as any,
    queue as any,
  );
  return { service, prisma, knowledge, queue };
}

/**
 * These are the tests that matter most. The gate recommends; it must never be
 * able to authorize spend on its own.
 */
describe('CreativeEnrollmentReviewService.assertPublishable', () => {
  const base = {
    id: reviewId,
    status: 'COMPLETED',
    shadow: false,
    decision: 'APPROVE',
    outcome: 'ACCEPTED',
  };

  it('allows publishing only when a person accepted an APPROVE out of shadow mode', async () => {
    const { service } = setup({ review: base });
    await expect(service.assertPublishable(tenantId, creativeId)).resolves.toMatchObject({ id: reviewId });
  });

  it('refuses when the creative never went through the gate', async () => {
    const { service } = setup({ review: null });
    await expect(service.assertPublishable(tenantId, creativeId))
      .rejects.toThrow(/has not been through the enrollment gate/i);
  });

  it('refuses while the gate is still in shadow mode', async () => {
    // Shadow reviews exist to be measured against people, not acted on.
    const { service } = setup({ review: { ...base, shadow: true } });
    await expect(service.assertPublishable(tenantId, creativeId))
      .rejects.toThrow(/shadow mode/i);
  });

  it('refuses a REVISE recommendation', async () => {
    const { service } = setup({ review: { ...base, decision: 'REVISE' } });
    await expect(service.assertPublishable(tenantId, creativeId)).rejects.toThrow(/REVISE/);
  });

  it('refuses a REJECT recommendation', async () => {
    const { service } = setup({ review: { ...base, decision: 'REJECT' } });
    await expect(service.assertPublishable(tenantId, creativeId)).rejects.toThrow(/REJECT/);
  });

  it('refuses an APPROVE that no person has accepted yet', async () => {
    // This is the important one: the AI approving is not authorization.
    const { service } = setup({ review: { ...base, outcome: 'PENDING' } });
    await expect(service.assertPublishable(tenantId, creativeId))
      .rejects.toThrow(/person must accept/i);
  });

  it('refuses an APPROVE a person overrode', async () => {
    const { service } = setup({ review: { ...base, outcome: 'OVERRIDDEN' } });
    await expect(service.assertPublishable(tenantId, creativeId))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CreativeEnrollmentReviewService.request', () => {
  it('defaults to shadow mode when the caller does not say otherwise', async () => {
    const { service, prisma } = setup();
    await service.request({ userId, tenantId } as any, creativeId);
    expect(prisma.creativeEnrollmentReview.create.mock.calls[0][0].data.shadow).toBe(true);
  });

  it('leaves shadow mode only on an explicit false', async () => {
    const { service, prisma } = setup();
    await service.request({ userId, tenantId } as any, creativeId, { shadow: false });
    expect(prisma.creativeEnrollmentReview.create.mock.calls[0][0].data.shadow).toBe(false);
  });

  it('records which entries informed the review, for audit', async () => {
    const { service, prisma, knowledge } = setup();
    knowledge.corpusForStore.mockResolvedValueOnce([
      { id: 'entry-1', label: 'WINNER' },
      { id: 'entry-2', label: 'LOSER' },
    ] as any);
    await service.request({ userId, tenantId } as any, creativeId);
    const data = prisma.creativeEnrollmentReview.create.mock.calls[0][0].data;
    expect(data.entryIds).toEqual(['entry-1', 'entry-2']);
    expect(data.corpusSize).toBe(2);
  });

  it('enqueues the review so it actually runs', async () => {
    const { service, queue } = setup();
    await service.request({ userId, tenantId } as any, creativeId);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect((queue.add.mock.calls[0] as any[])[1]).toMatchObject({ tenantId, reviewId });
  });

  it('refuses when the creative has no completed analysis to reason over', async () => {
    const { service, prisma } = setup();
    prisma.creativeAiRun.findFirst.mockResolvedValueOnce(null);
    await expect(service.request({ userId, tenantId } as any, creativeId))
      .rejects.toThrow(/no completed AI analysis/i);
  });
});

describe('CreativeEnrollmentReviewService.decide', () => {
  const completed = { id: reviewId, status: 'COMPLETED', outcome: 'PENDING' };

  it('requires a note when someone overrides the gate', async () => {
    // The disagreement is the calibration signal; an unexplained override
    // teaches nothing.
    const { service } = setup({ review: completed });
    await expect(service.decide({ userId, tenantId } as any, reviewId, { outcome: 'OVERRIDDEN' }))
      .rejects.toThrow(/say why/i);
  });

  it('accepts an agreement without a note', async () => {
    const { service } = setup({ review: completed });
    await expect(service.decide({ userId, tenantId } as any, reviewId, { outcome: 'ACCEPTED' }))
      .resolves.toMatchObject({ outcome: 'ACCEPTED' });
  });

  it('refuses to rule on a review that has not finished', async () => {
    const { service } = setup({ review: { ...completed, status: 'RUNNING' } });
    await expect(service.decide({ userId, tenantId } as any, reviewId, { outcome: 'ACCEPTED' }))
      .rejects.toThrow(/has not finished/i);
  });

  it('refuses to rule twice on the same review', async () => {
    const { service } = setup({ review: { ...completed, outcome: 'ACCEPTED' } });
    await expect(service.decide({ userId, tenantId } as any, reviewId, { outcome: 'ACCEPTED' }))
      .rejects.toThrow(/already been ruled on/i);
  });
});

describe('CreativeEnrollmentReviewService.calibration', () => {
  it('keeps the gate in shadow mode until enough reviews agree', async () => {
    const { service, prisma } = setup();
    prisma.creativeEnrollmentReview.groupBy.mockResolvedValueOnce([
      { decision: 'APPROVE', outcome: 'ACCEPTED', _count: { _all: 9 } },
      { decision: 'REJECT', outcome: 'OVERRIDDEN', _count: { _all: 1 } },
    ] as any);
    const result = await service.calibration({ userId, tenantId } as any);
    expect(result.agreementRate).toBe(90);
    // High agreement but only ten rulings: still too few to trust.
    expect(result.readyToLeaveShadow).toBe(false);
  });

  it('clears the gate once it has agreed often enough, over enough reviews', async () => {
    const { service, prisma } = setup();
    prisma.creativeEnrollmentReview.groupBy.mockResolvedValueOnce([
      { decision: 'APPROVE', outcome: 'ACCEPTED', _count: { _all: 26 } },
      { decision: 'REJECT', outcome: 'OVERRIDDEN', _count: { _all: 3 } },
    ] as any);
    const result = await service.calibration({ userId, tenantId } as any);
    expect(result.readyToLeaveShadow).toBe(true);
  });

  it('reports no agreement rate when nobody has ruled yet', async () => {
    const { service } = setup();
    const result = await service.calibration({ userId, tenantId } as any);
    expect(result.agreementRate).toBeNull();
    expect(result.readyToLeaveShadow).toBe(false);
  });
});
