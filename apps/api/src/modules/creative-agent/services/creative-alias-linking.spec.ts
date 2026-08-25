import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreativeAliasService } from './creative-alias.service';

type AnyFn = jest.Mock<(...args: never[]) => Promise<unknown>>;

const CONTEXT = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  isSuperAdmin: false,
  permissions: new Set(['creative_agent.alias.manage']),
};

function createAccess() {
  return {
    resolve: jest.fn<() => Promise<typeof CONTEXT>>().mockResolvedValue(CONTEXT),
    require: jest.fn(),
    has: jest.fn().mockReturnValue(true),
  } as never;
}

function createHarness(overrides: {
  insight?: { accountId: string; adId: string; adName: string } | null;
  existingLink?: { id: string } | null;
  creative?: { id: string } | null;
  unlinkTarget?: Record<string, unknown> | null;
} = {}) {
  const tx = {
    creativeMetaAdLink: {
      create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'link-1' }),
      delete: jest.fn<() => Promise<object>>().mockResolvedValue({}),
      findFirst: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    },
    creative: {
      updateMany: jest.fn<() => Promise<{ count: number }>>().mockResolvedValue({ count: 1 }),
      update: jest.fn<() => Promise<object>>().mockResolvedValue({}),
    },
    creativeAlias: { create: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'alias-1' }) },
    auditLog: { create: jest.fn<() => Promise<object>>().mockResolvedValue({}) },
  };
  const prisma = {
    metaAdInsight: {
      findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(
        overrides.insight === undefined
          ? { accountId: 'acct-1', adId: 'ad-1', adName: 'Totally free-form ad name' }
          : overrides.insight,
      ),
    },
    creativeMetaAdLink: {
      findFirst: jest.fn<() => Promise<unknown>>()
        .mockResolvedValue(overrides.existingLink ?? null),
    },
    creative: {
      findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(
        overrides.creative === undefined ? { id: 'creative-1' } : overrides.creative,
      ),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const service = new CreativeAliasService(prisma as never, createAccess());
  return { service, prisma, tx };
}

describe('CreativeAliasService identity linking', () => {
  it('links by identity without an alias, regardless of the ad name wording', async () => {
    const { service, tx, prisma } = createHarness();
    await service.linkUnregistered({ userId: 'user-1', tenantId: 'tenant-1' }, {
      creativeId: 'creative-1', accountId: 'acct-1', adId: 'ad-1',
    });
    expect(tx.creativeMetaAdLink.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1', creativeId: 'creative-1', accountId: 'acct-1', adId: 'ad-1',
        adNameSnapshot: 'Totally free-form ad name', source: 'MANUAL', linkedById: 'user-1',
      }),
    }));
    expect(tx.creativeAlias.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'creative.metaLink.manual' }),
    }));
    // tenant isolation: the insight lookup is tenant-scoped
    expect((prisma.metaAdInsight.findFirst as AnyFn).mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({ tenantId: 'tenant-1' }),
    });
  });

  it('rejects linking an ad that is already linked to a creative', async () => {
    const { service } = createHarness({ existingLink: { id: 'link-existing' } });
    await expect(service.linkUnregistered({ userId: 'user-1', tenantId: 'tenant-1' }, {
      creativeId: 'creative-2', accountId: 'acct-1', adId: 'ad-1',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects linking a Meta ad from another tenant (no insight visible)', async () => {
    const { service } = createHarness({ insight: null });
    await expect(service.linkUnregistered({ userId: 'user-1', tenantId: 'tenant-1' }, {
      creativeId: 'creative-1', accountId: 'other-tenant-acct', adId: 'ad-9',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still validates alias content when an alias IS provided', async () => {
    const { service } = createHarness({
      insight: { accountId: 'acct-1', adId: 'ad-1', adName: 'Some ad name' },
    });
    await expect(service.linkUnregistered({ userId: 'user-1', tenantId: 'tenant-1' }, {
      creativeId: 'creative-1', accountId: 'acct-1', adId: 'ad-1', alias: 'NOT-IN-NAME',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CreativeAliasService unlink', () => {
  const linkRow = {
    id: 'link-1', creativeId: 'creative-1', accountId: 'acct-1', adId: 'ad-1',
    adNameSnapshot: 'AP-V0001', source: 'AUTO_CODE',
    creative: { metaAccountId: 'acct-1', metaAdId: 'ad-1' },
  };

  function createUnlinkHarness(link: Record<string, unknown> | null, nextLink: Record<string, unknown> | null = null) {
    const tx = {
      creativeMetaAdLink: {
        delete: jest.fn<() => Promise<object>>().mockResolvedValue({}),
        findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(nextLink),
      },
      creative: { update: jest.fn<() => Promise<object>>().mockResolvedValue({}) },
      auditLog: { create: jest.fn<() => Promise<object>>().mockResolvedValue({}) },
    };
    const prisma = {
      creativeMetaAdLink: { findFirst: jest.fn<() => Promise<unknown>>().mockResolvedValue(link) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new CreativeAliasService(prisma as never, createAccess());
    return { service, prisma, tx };
  }

  it('unlinks by identity, re-points the primary link, and writes an audit record', async () => {
    const { service, tx } = createUnlinkHarness(linkRow, {
      accountId: 'acct-1', adId: 'ad-2', adNameSnapshot: 'AP-V0002',
      source: 'MANUAL', linkedAt: new Date('2026-01-01'), linkedById: 'user-2',
    });
    const result = await service.unlinkMetaAd({ userId: 'user-1', tenantId: 'tenant-1' }, 'acct-1', 'ad-1');
    expect(result).toMatchObject({ unlinked: true, creativeId: 'creative-1' });
    expect(tx.creativeMetaAdLink.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
    expect(tx.creative.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metaAdId: 'ad-2', metaLinkSource: 'MANUAL' }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'creative.metaLink.unlink',
        changes: expect.objectContaining({ accountId: 'acct-1', adId: 'ad-1', source: 'AUTO_CODE' }),
      }),
    }));
  });

  it('nulls the primary fields when the last link is removed', async () => {
    const { service, tx } = createUnlinkHarness(linkRow, null);
    await service.unlinkMetaAd({ userId: 'user-1', tenantId: 'tenant-1' }, 'acct-1', 'ad-1');
    expect(tx.creative.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metaAdId: null, metaAccountId: null, metaLinkSource: null }),
    }));
  });

  it('does not touch primary fields when a non-primary link is removed', async () => {
    const { service, tx } = createUnlinkHarness({
      ...linkRow, adId: 'ad-3', creative: { metaAccountId: 'acct-1', metaAdId: 'ad-1' },
    });
    await service.unlinkMetaAd({ userId: 'user-1', tenantId: 'tenant-1' }, 'acct-1', 'ad-3');
    expect(tx.creative.update).not.toHaveBeenCalled();
  });

  it('404s when the link does not exist in this tenant', async () => {
    const { service } = createUnlinkHarness(null);
    await expect(service.unlinkMetaAd({ userId: 'user-1', tenantId: 'tenant-1' }, 'acct-x', 'ad-x'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
