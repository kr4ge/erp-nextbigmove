import { describe, expect, it } from '@jest/globals';
import {
  resolveStoreAttribution,
  StoreAttributionIndex,
  UNATTRIBUTED_STORE_KEY,
} from './store-attribution';

function index(overrides: Partial<StoreAttributionIndex> = {}): StoreAttributionIndex {
  return {
    storeByShopId: new Map(),
    storeByAdId: new Map(),
    storeByCreativeCode: new Map(),
    storeByCodePrefix: new Map(),
    storeByLabel: new Map(),
    ...overrides,
  };
}

describe('resolveStoreAttribution', () => {
  it('prefers the actual POS order shop', () => {
    expect(resolveStoreAttribution(
      { adId: 'ad-1', shops: ['shop-1'] },
      index({
        storeByShopId: new Map([['shop-1', 'order-store']]),
        storeByAdId: new Map([['ad-1', 'linked-store']]),
      }),
    )).toBe('order-store');
  });

  it('uses a manual creative link even when the ad name has no convention', () => {
    expect(resolveStoreAttribution(
      { adId: 'ad-1', adName: 'Creative 12', shops: [] },
      index({ storeByAdId: new Map([['ad-1', 'linked-store']]) }),
    )).toBe('linked-store');
  });

  it('uses the enrolled creative for a static code with no matched orders', () => {
    expect(resolveStoreAttribution(
      { adId: 'ad-1', adName: 'ITEM_Travel Safety_SENTRA-I0065_Lyca', shops: [] },
      index({ storeByCreativeCode: new Map([['SENTRA-I0065', 'sentra-store']]) }),
    )).toBe('sentra-store');
  });

  it('uses a unique active store prefix when the exact code is not enrolled', () => {
    expect(resolveStoreAttribution(
      { adName: 'ITEM_Quiet Thinkers_CW-I0068_Lyca', shops: [] },
      index({ storeByCodePrefix: new Map([['CW', 'chapter-store']]) }),
    )).toBe('chapter-store');
  });

  it('keeps the unique legacy mapping fallback', () => {
    expect(resolveStoreAttribution(
      { adName: 'TaiSui_ThisCNY|Broad|BOF_Team2_1177_0124', mapping: 'tai sui' },
      index({ storeByLabel: new Map([['tai sui', 'legacy-store']]) }),
    )).toBe('legacy-store');
  });

  it('keeps ambiguous or missing attribution in the unattributed bucket', () => {
    expect(resolveStoreAttribution(
      { adName: 'Creative 12', mapping: 'shared-product', shops: [] },
      index({ storeByLabel: new Map([['shared-product', null]]) }),
    )).toBe(UNATTRIBUTED_STORE_KEY);
  });
});
