import { describe, expect, it, jest } from '@jest/globals';
import { codeCandidatesFor, CreativeMetaLinkService } from './creative-meta-link.service';

describe('CreativeMetaLinkService', () => {
  function createService(options: {
    insights: Array<{ accountId: string; adId: string; adName: string }>;
  }) {
    const transactionClient = {
      creativeMetaAdLink: {
        createMany: jest.fn<() => Promise<{ count: number }>>().mockImplementation(async () => ({ count: options.insights.length })),
      },
      creative: {
        updateMany: jest.fn<() => Promise<{ count: number }>>().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn<() => Promise<object>>().mockResolvedValue({}) },
    };
    const prisma = {
      creative: {
        findMany: jest.fn<() => Promise<Array<{ id: string; code: string }>>>()
          .mockResolvedValue([{ id: 'creative-1', code: 'AP-V0001' }]),
      },
      metaAdInsight: {
        findMany: jest.fn<() => Promise<typeof options.insights>>()
          .mockResolvedValue(options.insights),
      },
      $transaction: jest.fn(async (callback: (tx: typeof transactionClient) => Promise<unknown>) => (
        callback(transactionClient)
      )),
    };
    return {
      service: new CreativeMetaLinkService(prisma as never),
      prisma,
      transactionClient,
    };
  }

  it('persists an unambiguous canonical-code match', async () => {
    const { service, transactionClient } = createService({
      insights: [{ accountId: 'account-1', adId: 'ad-1', adName: 'AP-V0001' }],
    });

    await expect(service.reconcileInsights('tenant-1', [
      { accountId: 'account-1', adId: 'ad-1', adName: 'AP-V0001' },
    ])).resolves.toBe(1);

    expect(transactionClient.creative.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metaAccountId: 'account-1',
        metaAdId: 'ad-1',
        metaLinkSource: 'AUTO_CODE',
      }),
    }));
  });

  it('links every Meta ad that exactly reuses the canonical creative code', async () => {
    const { service, prisma, transactionClient } = createService({
      insights: [
        { accountId: 'account-1', adId: 'ad-1', adName: 'AP-V0001' },
        { accountId: 'account-1', adId: 'ad-2', adName: 'AP-V0001' },
      ],
    });

    await expect(service.reconcileInsights('tenant-1', [
      { accountId: 'account-1', adId: 'ad-2', adName: 'AP-V0001' },
    ])).resolves.toBe(2);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(transactionClient.creativeMetaAdLink.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ adId: 'ad-1', creativeId: 'creative-1' }),
        expect.objectContaining({ adId: 'ad-2', creativeId: 'creative-1' }),
      ]),
    }));
  });

  it('does not auto-link when the creative code is only part of the ad name', async () => {
    const { service, prisma } = createService({ insights: [] });

    await expect(service.reconcileInsights('tenant-1', [
      { accountId: 'account-1', adId: 'ad-1', adName: 'Launch AP-V0001 today' },
    ])).resolves.toBe(0);

    expect(prisma.creative.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ code: { in: ['Launch AP-V0001 today'] } }),
    }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('codeCandidatesFor', () => {
  it('matches a bare code', () => {
    expect(codeCandidatesFor('NRO-0041')).toContain('NRO-0041');
  });

  it('reads the code from the last underscore segment of a paste-ready ad name', () => {
    expect(codeCandidatesFor('Test 1_Frage Perez_NRO-0041')).toContain('NRO-0041');
  });

  it('tolerates surrounding whitespace', () => {
    expect(codeCandidatesFor('  Test 1_Frage Perez_NRO-0041  ')).toContain('NRO-0041');
  });

  it('ignores a code that is not the final segment', () => {
    // Prose mentioning a code must not link; only the trailing segment counts.
    expect(codeCandidatesFor('NRO-0041_retest_v2')).not.toContain('NRO-0041');
  });

  it('never matches a code buried mid-name without underscores', () => {
    expect(codeCandidatesFor('promo NRO-0041 retest')).toEqual(['promo NRO-0041 retest']);
  });

  it('returns nothing for an empty name', () => {
    expect(codeCandidatesFor('   ')).toEqual([]);
  });
});

describe('codeCandidatesFor — new convention', () => {
  it('links the new format via its mid-name code segment', () => {
    expect(codeCandidatesFor('OGM-100_Kidney Hook_NRO-V0069_Josiah')).toContain('NRO-V0069');
  });

  it('still links the legacy copy format via its last segment', () => {
    expect(codeCandidatesFor('Test 1_Frage Perez_NRO-V0041')).toContain('NRO-V0041');
  });

  it('still never links a code mentioned in prose', () => {
    expect(codeCandidatesFor('promo NRO-V0041 retest')).toEqual(['promo NRO-V0041 retest']);
  });
});
