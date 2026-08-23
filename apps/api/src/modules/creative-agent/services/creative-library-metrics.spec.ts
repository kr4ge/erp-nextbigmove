import { describe, expect, it } from '@jest/globals';
import { CreativeLibraryService } from './creative-library.service';

describe('CreativeLibraryService metric formulas', () => {
  const service = new CreativeLibraryService({} as never, {} as never);
  const serialize = (kind: 'VIDEO' | 'STATIC', video: Record<string, number> = {}) => {
    const creative = {
      id: 'creative-1',
      code: 'NRO-V0001',
      title: 'Test',
      kind,
      storeConfig: {
        id: 'config-1', storeId: 'store-1', storeNameSnapshot: 'Store',
        shopIdSnapshot: 'shop-1', codePrefix: 'NRO', active: true,
      },
      createdBy: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com', avatar: null },
      aliases: [],
      metaAccountId: null,
      metaAdId: null,
      metaAdNameSnapshot: null,
      metaLinkSource: null,
      metaLinkedAt: null,
      format: null,
      hookType: null,
      script: null,
      notes: null,
      mediaUrl: null,
      qcStatus: 'FOR_APPROVAL',
      performanceStatus: 'DRAFT',
      submittedAt: null,
      approvedAt: null,
      createdAt: new Date('2026-08-20'),
      updatedAt: new Date('2026-08-20'),
    };
    const metrics = {
      spend: 580,
      impressions: 1000,
      clicks: 80,
      linkClicks: 20,
      video,
      accountIds: new Set(['account-1']),
    };
    return (service as unknown as {
      serializeCreative(creative: unknown, metrics: unknown): { metrics: Record<string, number | null> };
    }).serializeCreative(creative, metrics).metrics;
  };

  it('uses aggregated raw totals for Hook, Hold, completion, and link CTR', () => {
    const metrics = serialize('VIDEO', {
      videoPlays3s: 300,
      thruPlays: 150,
      videoPlays25: 240,
      videoPlays100: 120,
    });

    expect(metrics).toMatchObject({
      hookRate: 0.3,
      holdRate: 0.5,
      completionRate: 0.15,
      ctr: 0.02,
      cpm: 580,
      costPerThruPlay: 3.87,
      retention25: 0.8,
      retention100: 0.4,
    });
  });

  it('withholds impossible and static video rates instead of returning false zeroes', () => {
    expect(serialize('VIDEO', { videoPlays3s: 200, thruPlays: 250 })).toMatchObject({
      holdRate: null,
      completionRate: 0.25,
    });
    expect(serialize('STATIC', { videoPlays3s: 0, thruPlays: 0 })).toMatchObject({
      hookRate: null,
      holdRate: null,
      completionRate: null,
    });
  });
});
