import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CreativeWorkflowService } from './creative-workflow.service';

const REVIEWER_CONTEXT = {
  tenantId: 'tenant-1',
  userId: 'reviewer-1',
  isSuperAdmin: false,
  permissions: new Set(['creative_agent.read_all', 'creative_agent.review']),
};

function createHarness(options: {
  creative: Record<string, unknown>;
  updateCount?: number;
  context?: typeof REVIEWER_CONTEXT;
}) {
  const tx = {
    creative: {
      updateMany: jest.fn<() => Promise<{ count: number }>>()
        .mockResolvedValue({ count: options.updateCount ?? 1 }),
    },
    creativeStatusEvent: {
      create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'event-1' }),
    },
    creativeReviewComment: {
      create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'comment-1' }),
    },
  };
  const prisma = {
    creative: { findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(options.creative) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const context = options.context ?? REVIEWER_CONTEXT;
  const access = {
    resolve: jest.fn<() => Promise<typeof context>>().mockResolvedValue(context),
    require: jest.fn((ctx: typeof context, ...perms: string[]) => {
      if (!perms.some((perm) => ctx.permissions.has(perm))) {
        throw new ForbiddenException('Insufficient creative workspace permissions');
      }
    }),
    has: jest.fn((ctx: typeof context, perm: string) => ctx.permissions.has(perm)),
    canEdit: jest.fn((ctx: typeof context, createdById: string) =>
      ctx.permissions.has('creative_agent.edit_all')
      || (createdById === ctx.userId && ctx.permissions.has('creative_agent.edit'))),
  } as never;
  return { service: new CreativeWorkflowService(prisma as never, access), prisma, tx };
}

const baseCreative = {
  id: 'creative-1',
  tenantId: 'tenant-1',
  createdById: 'maker-1',
  qcStatus: 'FOR_APPROVAL',
  submittedAt: new Date('2026-08-01T00:00:00Z'),
  approvedAt: null,
};

describe('QC workflow guards', () => {
  it('rejects a reviewer approving their own submission', async () => {
    const { service } = createHarness({
      creative: { ...baseCreative, createdById: 'reviewer-1' },
    });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'FOR_POSTING',
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a revision without a reason', async () => {
    const { service } = createHarness({ creative: baseCreative });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'FOR_REVISION',
    } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cancellation without a reason', async () => {
    const { service } = createHarness({ creative: baseCreative });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'CANCELLED',
    } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 when a concurrent reviewer already moved the status', async () => {
    const { service } = createHarness({ creative: baseCreative, updateCount: 0 });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'FOR_POSTING',
    } as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves with a compare-and-swap on the current status and write-once approvedAt', async () => {
    const { service, tx } = createHarness({ creative: baseCreative });
    await service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'FOR_POSTING',
    } as never);
    const call = (tx.creative.updateMany.mock.calls as unknown as Array<[{
      where: Record<string, unknown>; data: Record<string, unknown>;
    }]>)[0][0];
    expect(call.where).toMatchObject({ id: 'creative-1', tenantId: 'tenant-1', qcStatus: 'FOR_APPROVAL' });
    expect(call.data.approvedAt).toBeInstanceOf(Date);
  });

  it('does not reset approvedAt on a re-approval after a revision cycle', async () => {
    const { service, tx } = createHarness({
      creative: { ...baseCreative, qcStatus: 'REVISED', approvedAt: new Date('2026-08-02T00:00:00Z') },
    });
    await service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'FOR_POSTING',
    } as never);
    const call = (tx.creative.updateMany.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>)[0][0];
    expect(call.data.approvedAt).toBeUndefined();
  });

  it('rejects an illegal transition with a conflict', async () => {
    const { service } = createHarness({ creative: { ...baseCreative, qcStatus: 'POSTED' } });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', {
      dimension: 'QC', toStatus: 'FOR_REVISION', reason: 'nope',
    } as never)).rejects.toBeInstanceOf(ConflictException);
  });
});
