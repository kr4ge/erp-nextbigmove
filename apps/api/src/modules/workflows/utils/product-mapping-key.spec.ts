import { describe, expect, it } from '@jest/globals';
import {
  buildProductMappingKey,
  parseProductMappingKey,
  buildUnassignedMappingKey,
  parseUnassignedMappingKey,
  resolveMappingDisplayNames,
} from './product-mapping-key';

describe('product-mapping-key', () => {
  const storeId = 'A1B2C3D4-0000-0000-0000-000000000001';
  const variationId = 'f6460caa-eadf-442f-bd00-a20500f665f9';

  it('builds a lowercased, store-scoped key', () => {
    const key = buildProductMappingKey(storeId, variationId);
    expect(key).toBe(
      `pv::${storeId.toLowerCase()}::${variationId.toLowerCase()}`,
    );
  });

  it('round-trips build -> parse', () => {
    const key = buildProductMappingKey(storeId, variationId)!;
    const parsed = parseProductMappingKey(key);
    expect(parsed).toEqual({
      storeId: storeId.toLowerCase(),
      variationId: variationId.toLowerCase(),
    });
  });

  it('returns null when either part is missing (caller falls back to coarse label)', () => {
    expect(buildProductMappingKey(storeId, null)).toBeNull();
    expect(buildProductMappingKey(null, variationId)).toBeNull();
    expect(buildProductMappingKey('', '')).toBeNull();
    expect(buildProductMappingKey('  ', variationId)).toBeNull();
  });

  it('treats coarse labels as non-keys', () => {
    expect(parseProductMappingKey('pinoy gadget')).toBeNull();
    expect(parseProductMappingKey('the pet pantry')).toBeNull();
    expect(parseProductMappingKey('')).toBeNull();
    expect(parseProductMappingKey(null)).toBeNull();
  });

  it('rejects malformed keys', () => {
    expect(parseProductMappingKey('pv::onlyone')).toBeNull();
    expect(parseProductMappingKey('pv::a::b::c')).toBeNull();
    expect(parseProductMappingKey('xx::store::variation')).toBeNull();
    expect(parseProductMappingKey('pv::::variation')).toBeNull();
  });

  it('same variation in two different stores yields distinct keys (no cross-store collision)', () => {
    const store2 = 'B2B2B2B2-0000-0000-0000-000000000002';
    const k1 = buildProductMappingKey(storeId, variationId);
    const k2 = buildProductMappingKey(store2, variationId);
    expect(k1).not.toEqual(k2);
  });

  describe('unassigned (store-scoped) key', () => {
    it('builds a store-scoped unassigned key', () => {
      expect(buildUnassignedMappingKey(storeId)).toBe(
        `ua::${storeId.toLowerCase()}`,
      );
    });

    it('round-trips build -> parse', () => {
      const key = buildUnassignedMappingKey(storeId)!;
      expect(parseUnassignedMappingKey(key)).toEqual({
        storeId: storeId.toLowerCase(),
      });
    });

    it('returns null with no store (caller keeps null mapping)', () => {
      expect(buildUnassignedMappingKey(null)).toBeNull();
      expect(buildUnassignedMappingKey('  ')).toBeNull();
    });

    it('does not confuse a product key with an unassigned key and vice versa', () => {
      const pv = buildProductMappingKey(storeId, variationId)!;
      const ua = buildUnassignedMappingKey(storeId)!;
      expect(parseUnassignedMappingKey(pv)).toBeNull();
      expect(parseProductMappingKey(ua)).toBeNull();
    });

    it('treats coarse labels as non-keys', () => {
      expect(parseUnassignedMappingKey('pinoy gadget')).toBeNull();
      expect(parseUnassignedMappingKey(null)).toBeNull();
    });
  });

  describe('resolveMappingDisplayNames', () => {
    const store = 'aaaaaaaa-0000-0000-0000-000000000001';
    const variation = 'bbbbbbbb-0000-0000-0000-000000000002';
    const fakeDb = {
      posProduct: {
        findMany: async () => [
          { storeId: store, variationId: variation, name: '220G SEAWEED' },
        ],
      },
      posStore: {
        findMany: async () => [{ id: store, name: 'NBM Store' }],
      },
    };

    it('rewrites pv:: keys to product names, ua:: to store-scoped Unassigned, leaves labels alone', async () => {
      const pvKey = buildProductMappingKey(store, variation)!;
      const uaKey = buildUnassignedMappingKey(store)!;
      const map: Record<string, string> = {
        [pvKey]: pvKey,
        [uaKey]: uaKey,
        'pinoy gadget': 'pinoy gadget',
      };
      await resolveMappingDisplayNames(fakeDb, map);
      expect(map[pvKey]).toBe('220G SEAWEED');
      expect(map[uaKey]).toBe('Unassigned — NBM Store');
      expect(map['pinoy gadget']).toBe('pinoy gadget');
    });

    it('falls back to the raw key when the product no longer exists', async () => {
      const orphanKey = buildProductMappingKey(store, 'cccccccc-0000-0000-0000-000000000003')!;
      const map: Record<string, string> = { [orphanKey]: orphanKey };
      await resolveMappingDisplayNames(fakeDb, map);
      expect(map[orphanKey]).toBe(orphanKey);
    });
  });
});
