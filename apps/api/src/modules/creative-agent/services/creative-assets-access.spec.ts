import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { CreativeAssetsService } from './creative-assets.service';

function createHarness(permissions: string[]) {
  const context = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    isSuperAdmin: false,
    permissions: new Set(permissions),
  };
  const access = {
    resolve: jest.fn<() => Promise<typeof context>>().mockResolvedValue(context),
    require: jest.fn((ctx: typeof context, ...perms: string[]) => {
      if (!perms.some((perm) => ctx.permissions.has(perm))) {
        throw new ForbiddenException('Insufficient creative workspace permissions');
      }
    }),
    has: jest.fn((ctx: typeof context, perm: string) => ctx.permissions.has(perm)),
    canReadAll: jest.fn((ctx: typeof context) => ctx.permissions.has('creative_agent.read_all')),
  } as never;
  const prisma = {
    creative: {
      findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
      count: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      groupBy: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    },
    creativeStoreConfig: {
      findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    },
    // Creator labels are built from the tenant's users; an empty tenant is fine.
    user: {
      findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    },
  };
  const mediaAssets = {
    createSignedAssetUrl: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  } as never;
  return { service: new CreativeAssetsService(prisma as never, access, mediaAssets), prisma };
}

const baseQuery = { page: 1, pageSize: 12 };

describe('CreativeAssetsService access', () => {
  it('admits the Advertising persona (read_all + review) tenant-wide', async () => {
    const { service, prisma } = createHarness(['creative_agent.read_all', 'creative_agent.review']);
    const result = await service.list({ userId: 'user-1', tenantId: 'tenant-1' }, baseQuery as never);
    expect(result.permissions.canReadAll).toBe(true);
    const call = (prisma.creative.findMany.mock.calls as unknown as Array<[{ where: Record<string, unknown> }]>)[0][0];
    expect(call.where).toMatchObject({ tenantId: 'tenant-1' });
    expect(call.where.createdById).toBeUndefined();
  });

  it('pins a plain Creative persona to their own records', async () => {
    const { service, prisma } = createHarness(['creative_agent.read']);
    const result = await service.list({ userId: 'user-1', tenantId: 'tenant-1' }, baseQuery as never);
    expect(result.permissions.canReadAll).toBe(false);
    const call = (prisma.creative.findMany.mock.calls as unknown as Array<[{ where: Record<string, unknown> }]>)[0][0];
    expect(call.where).toMatchObject({ createdById: 'user-1' });
  });

  it('ignores the creatorId filter for users without read_all', async () => {
    const { service, prisma } = createHarness(['creative_agent.read']);
    await service.list({ userId: 'user-1', tenantId: 'tenant-1' }, { ...baseQuery, creatorId: 'someone-else' } as never);
    const call = (prisma.creative.findMany.mock.calls as unknown as Array<[{ where: Record<string, unknown> }]>)[0][0];
    expect(call.where).toMatchObject({ createdById: 'user-1' });
  });

  it('rejects a user with no creative permissions at all', async () => {
    const { service } = createHarness(['analytics.sales']);
    await expect(service.list({ userId: 'user-1', tenantId: 'tenant-1' }, baseQuery as never))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('narrows the REVIEW queue to open change requests, oldest first', async () => {
    const { service, prisma } = createHarness(['creative_agent.read_all', 'creative_agent.review']);
    await service.list({ userId: 'user-1', tenantId: 'tenant-1' }, { ...baseQuery, queue: 'REVIEW' } as never);
    const call = (prisma.creative.findMany.mock.calls as unknown as Array<[{
      where: { revisionState: { in: string[] } }; orderBy: unknown[];
    }]>)[0][0];
    expect(call.where.revisionState.in).toEqual(['NEEDS_REVISION']);
    expect(call.orderBy).toEqual([{ revisionRequestedAt: 'asc' }, { code: 'asc' }]);
  });
});
