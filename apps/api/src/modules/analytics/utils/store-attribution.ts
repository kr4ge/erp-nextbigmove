import { deriveCreativeCodeFromAdName } from '../../creative-agent/utils/ad-name-convention';
import {
  parseProductMappingKey,
  parseUnassignedMappingKey,
} from '../../workflows/utils/product-mapping-key';

export const UNATTRIBUTED_STORE_KEY = '__unattributed__';

export type StoreAttributionRow = {
  adId?: string | null;
  adName?: string | null;
  mapping?: string | null;
  shops?: unknown;
};

export type StoreAttributionIndex = {
  storeByShopId: ReadonlyMap<string, string>;
  storeByAdId: ReadonlyMap<string, string>;
  storeByCreativeCode: ReadonlyMap<string, string>;
  storeByCodePrefix: ReadonlyMap<string, string>;
  storeByLabel: ReadonlyMap<string, string | null>;
};

export function creativeCodeParts(adName: string | null | undefined): {
  code: string;
  prefix: string;
} | null {
  const code = deriveCreativeCodeFromAdName(adName);
  if (!code) return null;
  const separator = code.lastIndexOf('-');
  if (separator <= 0) return null;
  return { code, prefix: code.slice(0, separator) };
}

/**
 * Resolve an insight row to its tenant store using the same precedence shown
 * in Analytics / Sales:
 *
 * actual order shop -> explicit creative link -> exact registry code ->
 * unique configured code prefix -> precise/legacy mapping -> unattributed.
 *
 * Manual links remain authoritative even when the ad name has no convention.
 * Prefix inference is tenant-scoped and only populated from unique active
 * CreativeStoreConfig rows.
 */
export function resolveStoreAttribution(
  row: StoreAttributionRow,
  index: StoreAttributionIndex,
): string {
  const shops = Array.isArray(row.shops) ? row.shops : [];
  const rawShopId = shops[0];
  const shopId = typeof rawShopId === 'string'
    ? rawShopId
    : rawShopId != null
      ? String(rawShopId)
      : null;
  if (shopId) {
    const orderStore = index.storeByShopId.get(shopId);
    if (orderStore) return orderStore;
  }

  if (row.adId) {
    const linkedStore = index.storeByAdId.get(row.adId);
    if (linkedStore) return linkedStore;
  }

  const code = creativeCodeParts(row.adName);
  if (code) {
    const registryStore = index.storeByCreativeCode.get(code.code);
    if (registryStore) return registryStore;
    const prefixStore = index.storeByCodePrefix.get(code.prefix);
    if (prefixStore) return prefixStore;
  }

  const mapping = typeof row.mapping === 'string' ? row.mapping : null;
  const productKey = parseProductMappingKey(mapping);
  if (productKey) return productKey.storeId;
  const unassignedKey = parseUnassignedMappingKey(mapping);
  if (unassignedKey) return unassignedKey.storeId;

  const label = mapping?.trim().toLowerCase();
  if (label) {
    const legacyStore = index.storeByLabel.get(label);
    if (legacyStore) return legacyStore;
  }

  return UNATTRIBUTED_STORE_KEY;
}
