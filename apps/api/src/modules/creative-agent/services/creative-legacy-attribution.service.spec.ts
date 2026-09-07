import { describe, expect, it, jest } from '@jest/globals';
import { CreativeLegacyAttributionService } from './creative-legacy-attribution.service';

describe('CreativeLegacyAttributionService', () => {
  const creator = {
    id: 'creator-1',
    employeeId: '1177',
    firstName: 'Creative',
    lastName: 'Tester',
    email: 'creative@example.com',
  };

  const makeService = (overrides: {
    rows?: Array<Record<string, unknown>>;
    links?: Array<{ adId: string }>;
  } = {}) => {
    const rows = overrides.rows ?? [{
      adId: 'old-ad-1',
      accountId: 'account-1',
      adName: 'TaiSui_ThisCNY|Broad|BOF_Team2_1177_0124',
      campaignName: 'TaiSui',
      marketingAssociate: '1177',
      shops: [],
    }];
    const links = overrides.links ?? [];
    const prisma = {
      user: { findMany: jest.fn<() => Promise<typeof creator[]>>().mockResolvedValue([creator]) },
      posStore: { findMany: jest.fn<() => Promise<Array<{ shopId: string }>>>().mockResolvedValue([]) },
      reconcileMarketing: {
        findMany: jest.fn<() => Promise<typeof rows>>().mockResolvedValue(rows),
      },
      creativeMetaAdLink: { findMany: jest.fn<() => Promise<typeof links>>().mockResolvedValue(links) },
      creative: { findMany: jest.fn<() => Promise<Array<{ metaAdId: string | null }>>>().mockResolvedValue([]) },
    };
    return { service: new CreativeLegacyAttributionService(prisma as never), prisma };
  };

  it('attributes an unlinked legacy ad through the creator employee ID', async () => {
    const { service } = makeService();

    const result = await service.resolveLegacyAds({
      tenantId: 'tenant-1',
      creatorIds: ['creator-1'],
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result).toEqual([expect.objectContaining({
      adId: 'old-ad-1',
      creator: expect.objectContaining({ id: 'creator-1', employeeId: '1177' }),
    })]);
  });

  it('does not claim an ad that already has an explicit registry link', async () => {
    const { service } = makeService({ links: [{ adId: 'old-ad-1' }] });

    const result = await service.resolveLegacyAds({
      tenantId: 'tenant-1',
      creatorIds: ['creator-1'],
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result).toEqual([]);
  });

  it('recovers the employee ID from the old ad name when a historical row has no stored associate', async () => {
    const { service } = makeService({ rows: [{
      adId: 'old-ad-1',
      accountId: 'account-1',
      adName: 'TaiSui_ThisCNY|Broad|BOF_Team2_1177_0124',
      campaignName: 'TaiSui',
      marketingAssociate: null,
      shops: [],
    }] });

    const result = await service.resolveLegacyAds({
      tenantId: 'tenant-1',
      creatorIds: ['creator-1'],
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0].creator.employeeId).toBe('1177');
  });
});
