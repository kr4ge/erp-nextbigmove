import { describe, expect, it, jest } from '@jest/globals';
import { MetaInsightService } from './meta-insight.service';

const RAW_INSIGHT = {
  campaign_id: 'campaign-1',
  campaign_name: 'Campaign',
  adset_id: 'adset-1',
  ad_id: 'ad-1',
  ad_name: 'AP-V0001',
  date_start: '2026-09-09',
  spend: '100',
  impressions: '1000',
};

function createHarness(existing: { accountId: string; adId: string; adName: string } | null) {
  const tx = {
    $queryRaw: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
    metaAdInsight: {
      findUnique: jest.fn<() => Promise<typeof existing>>().mockResolvedValue(existing),
      upsert: jest.fn<() => Promise<{ accountId: string; adId: string; adName: string }>>()
        .mockResolvedValue({ accountId: '1889518721645704', adId: 'ad-1', adName: 'AP-V0001' }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const links = {
    reconcileInsights: jest.fn<() => Promise<number>>().mockResolvedValue(0),
  };
  return {
    service: new MetaInsightService(prisma as never, links as never),
    tx,
    links,
  };
}

describe('MetaInsightService canonical ad identity', () => {
  it('does not let a manual CSV identity overwrite an existing provider row', async () => {
    const provider = {
      accountId: '1889518721645704',
      adId: 'ad-1',
      adName: 'AP-V0001',
    };
    const { service, tx, links } = createHarness(provider);

    await expect(service.upsertMetaInsights(
      'tenant-1',
      'manual:legacy-upload',
      [RAW_INSIGHT],
      null,
    )).resolves.toBe(0);

    expect(tx.metaAdInsight.upsert).not.toHaveBeenCalled();
    expect(links.reconcileInsights).toHaveBeenCalledWith('tenant-1', [provider]);
  });

  it('replaces a temporary manual identity when provider data arrives', async () => {
    const { service, tx, links } = createHarness({
      accountId: 'manual:legacy-upload',
      adId: 'ad-1',
      adName: 'AP-V0001',
    });

    await expect(service.upsertMetaInsights(
      'tenant-1',
      '1889518721645704',
      [RAW_INSIGHT],
      null,
    )).resolves.toBe(1);

    expect(tx.metaAdInsight.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId_adId_date: {
          tenantId: 'tenant-1',
          adId: 'ad-1',
          date: new Date('2026-09-09'),
        },
      },
      update: expect.objectContaining({ accountId: '1889518721645704' }),
    }));
    expect(links.reconcileInsights).toHaveBeenCalledWith('tenant-1', [{
      accountId: '1889518721645704',
      adId: 'ad-1',
      adName: 'AP-V0001',
    }]);
  });
});
