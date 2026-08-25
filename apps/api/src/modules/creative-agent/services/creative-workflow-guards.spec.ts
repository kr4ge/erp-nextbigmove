import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CreativeWorkflowService } from './creative-workflow.service';

const REVIEWER_CONTEXT = {
  tenantId: 'tenant-1',
  userId: 'reviewer-1',
  isSuperAdmin: false,
  permissions: new Set(['creative_agent.read_all', 'creative_agent.review']),
};

const OWNER_CONTEXT = {
  tenantId: 'tenant-1',
  userId: 'maker-1',
  isSuperAdmin: false,
  permissions: new Set(['creative_agent.read', 'creative_agent.edit']),
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
  revisionState: 'NONE',
  performanceStatus: 'LIVE',
};

const request = (extra: Record<string, unknown> = {}) =>
  ({ dimension: 'REVISION', toStatus: 'NEEDS_REVISION', ...extra }) as never;

describe('revision request guards', () => {
  it('requires a description of the changes being asked for', async () => {
    const { service } = createHarness({ creative: baseCreative });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request()))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects requesting revisions on your own creative', async () => {
    const { service } = createHarness({
      creative: { ...baseCreative, createdById: 'reviewer-1' },
    });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request({ reason: 'Tighten the hook' })))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('opens a request with a compare-and-swap and stamps the requested time', async () => {
    const { service, tx } = createHarness({ creative: baseCreative });
    await service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request({ reason: 'Tighten the hook' }));
    const call = (tx.creative.updateMany.mock.calls as unknown as Array<[{
      where: Record<string, unknown>; data: Record<string, unknown>;
    }]>)[0][0];
    expect(call.where).toMatchObject({ id: 'creative-1', tenantId: 'tenant-1', revisionState: 'NONE' });
    expect(call.data.revisionState).toBe('NEEDS_REVISION');
    expect(call.data.revisionRequestedAt).toBeInstanceOf(Date);
    expect(call.data.revisionResolvedAt).toBeNull();
  });

  it('turns the reason into the opening message of the thread', async () => {
    const { service, tx } = createHarness({ creative: baseCreative });
    await service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request({ reason: 'Tighten the hook' }));
    expect(tx.creativeReviewComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ message: 'Tighten the hook', authorId: 'reviewer-1' }),
    }));
  });

  it('returns 409 when someone else already changed the state', async () => {
    const { service } = createHarness({ creative: baseCreative, updateCount: 0 });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request({ reason: 'Tighten the hook' })))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an illegal transition', async () => {
    const { service } = createHarness({ creative: { ...baseCreative, revisionState: 'NEEDS_REVISION' } });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request({ reason: 'again' })))
      .rejects.toBeInstanceOf(ConflictException);
  });
});

describe('revision resolution', () => {
  const openCreative = { ...baseCreative, revisionState: 'NEEDS_REVISION' };
  const resolve = { dimension: 'REVISION', toStatus: 'RESOLVED' } as never;

  it('lets the owner resolve their own request without a reason', async () => {
    const { service, tx } = createHarness({ creative: openCreative, context: OWNER_CONTEXT });
    await service.transition({ userId: 'maker-1', tenantId: 'tenant-1' }, 'creative-1', resolve);
    const call = (tx.creative.updateMany.mock.calls as unknown as Array<[{ data: Record<string, unknown> }]>)[0][0];
    expect(call.data.revisionState).toBe('RESOLVED');
    expect(call.data.revisionResolvedAt).toBeInstanceOf(Date);
  });

  it('lets a reviewer close out a request too', async () => {
    const { service } = createHarness({ creative: openCreative });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', resolve))
      .resolves.toMatchObject({ toStatus: 'RESOLVED', dimension: 'REVISION' });
  });

  it('rejects an unrelated user resolving the request', async () => {
    const { service } = createHarness({
      creative: openCreative,
      context: { ...OWNER_CONTEXT, userId: 'someone-else' },
    });
    await expect(service.transition({ userId: 'someone-else', tenantId: 'tenant-1' }, 'creative-1', resolve))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows reopening a resolved request', async () => {
    const { service } = createHarness({ creative: { ...baseCreative, revisionState: 'RESOLVED' } });
    await expect(service.transition({ userId: 'reviewer-1', tenantId: 'tenant-1' }, 'creative-1', request({ reason: 'Still off' })))
      .resolves.toMatchObject({ toStatus: 'NEEDS_REVISION' });
  });
});
