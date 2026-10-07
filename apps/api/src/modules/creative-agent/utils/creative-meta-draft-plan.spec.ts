import { describe, expect, it } from '@jest/globals';
import {
  adsManagerUrl,
  buildAdName,
  buildAdSetName,
  buildCampaignName,
  buildUrlTags,
  duplicateAngleWarnings,
  learningBudget,
  nextMidnight,
  suggestAdCount,
  toMinorUnits,
} from './creative-meta-draft-plan';

describe('creative meta draft plan', () => {
  describe('toMinorUnits', () => {
    it('bills pesos in centavos', () => {
      expect(toMinorUnits(1000, 'PHP')).toBe(100000);
      expect(toMinorUnits(1234.56, 'php')).toBe(123456);
    });

    it('bills zero-decimal currencies in whole units', () => {
      expect(toMinorUnits(1000, 'JPY')).toBe(1000);
    });

    it('defaults to a two-decimal currency when none is known', () => {
      expect(toMinorUnits(10, null)).toBe(1000);
    });

    it('refuses a negative budget', () => {
      expect(() => toMinorUnits(-1, 'PHP')).toThrow();
    });
  });

  describe('buildAdName', () => {
    it('puts the POS item first and the code third, the way makers already paste it', () => {
      expect(buildAdName({ customId: 'KFFW', title: 'Sale50 9x16 v1', code: 'SE-I0342', creator: 'Ana' }))
        .toBe('KFFW_Sale50 9x16 v1_SE-I0342_Ana');
    });

    it('falls back to the legacy shape without a POS item and never drops the code', () => {
      expect(buildAdName({ title: 'Hook A', creator: null, code: 'SE-V0001' })).toBe('Hook A_SE-V0001');
    });
  });

  describe('campaign and ad set names', () => {
    const launch = new Date('2026-09-29T16:00:00.000Z'); // 30 Sep, 00:00 Manila

    it('stamps the launch day in the store timezone', () => {
      expect(buildCampaignName({ codePrefix: 'SE', product: 'Rose Perfume 50ml', launchDate: launch, timezone: 'Asia/Manila' }))
        .toBe('SE_Rose-Perfume-50ml_20260930');
    });

    it('survives a missing product name', () => {
      expect(buildCampaignName({ codePrefix: 'SE', product: null, launchDate: launch, timezone: 'Asia/Manila' }))
        .toBe('SE_Product_20260930');
    });

    it('names the ad set by what it targets', () => {
      expect(buildAdSetName('SE_Product_20260930', ['ph'])).toBe('SE_Product_20260930_Broad-PH');
    });
  });

  describe('nextMidnight', () => {
    it('returns the next Manila midnight as a UTC instant', () => {
      // 14:00 UTC on 28 Sep is 22:00 Manila on 28 Sep; next midnight is 29 Sep 00:00 Manila = 28 Sep 16:00 UTC.
      const at = nextMidnight('Asia/Manila', new Date('2026-09-28T14:00:00.000Z'));
      expect(at.toISOString()).toBe('2026-09-28T16:00:00.000Z');
    });

    it('rolls to the day after when it is already past midnight locally', () => {
      // 17:00 UTC on 28 Sep is 01:00 Manila on 29 Sep; next midnight is 30 Sep 00:00 Manila.
      const at = nextMidnight('Asia/Manila', new Date('2026-09-28T17:00:00.000Z'));
      expect(at.toISOString()).toBe('2026-09-29T16:00:00.000Z');
    });
  });

  describe('suggestAdCount', () => {
    it('sends one ad for a proven winner', () => {
      expect(suggestAdCount({ hasProvenWinner: true, productEntryCount: 5, storeEntryCount: 20 }).suggested).toBe(1);
    });

    it('sends three for a product with no record', () => {
      const result = suggestAdCount({ hasProvenWinner: false, productEntryCount: 0, storeEntryCount: 4 });
      expect(result.suggested).toBe(3);
      expect(result.reason).toMatch(/product/i);
    });

    it('says so when the whole store has no record', () => {
      expect(suggestAdCount({ hasProvenWinner: false, productEntryCount: 0, storeEntryCount: 0 }).reason).toMatch(/store/i);
    });

    it('sends two when there is something to compare against', () => {
      expect(suggestAdCount({ hasProvenWinner: false, productEntryCount: 3, storeEntryCount: 9 }).suggested).toBe(2);
    });
  });

  describe('duplicateAngleWarnings', () => {
    it('warns when creatives share both angle and hook', () => {
      const warnings = duplicateAngleWarnings([
        { code: 'SE-V0001', angle: 'Guilt', hookType: 'Question' },
        { code: 'SE-V0002', angle: 'guilt ', hookType: 'question' },
        { code: 'SE-V0003', angle: 'Pride', hookType: 'Question' },
      ]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('SE-V0001 and SE-V0002');
    });

    it('stays quiet when a field is missing, because it cannot judge', () => {
      expect(duplicateAngleWarnings([
        { code: 'A', angle: null, hookType: 'Question' },
        { code: 'B', angle: null, hookType: 'Question' },
      ])).toEqual([]);
    });
  });

  it('builds dynamic UTM tags Meta fills at delivery', () => {
    expect(buildUrlTags()).toContain('utm_campaign={{campaign.name}}');
    expect(buildUrlTags()).toContain('utm_content={{ad.name}}');
  });

  it('computes the budget that leaves learning in a week', () => {
    expect(learningBudget(300)).toBe(2143);
    expect(learningBudget(null)).toBeNull();
  });

  it('deep-links to the campaign in Ads Manager', () => {
    expect(adsManagerUrl('123', '456')).toBe('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=123&selected_campaign_ids=456');
    expect(adsManagerUrl('123')).not.toContain('selected_campaign_ids');
  });
});
