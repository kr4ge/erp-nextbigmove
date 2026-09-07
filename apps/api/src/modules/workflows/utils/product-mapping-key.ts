/**
 * The `mapping` value on `reconcile_marketing` (and `pos_orders`) is the join
 * key between ad spend and sales. Historically it was a coarse product label
 * (e.g. "pinoy gadget") that grouped many product variations together, so the
 * per-product breakdown could never name a single product.
 *
 * When a row can be pinned to exactly one product variation we instead store a
 * precise, store-scoped key built here. `(storeId, variationId)` is unique in
 * `pos_products` (variationId can repeat across stores, and customId can repeat
 * even within a store), so embedding the storeId prevents cross-store
 * collisions. The dropdown resolves this key back to the product name.
 *
 * Anything that cannot be pinned to a single variation (multi-product orders,
 * ads with no creative link / no resolvable code, legacy rows) keeps the coarse
 * label, so the ad<->sales join is never broken by this change.
 */

const PREFIX = 'pv';
const UNASSIGNED_PREFIX = 'ua';
const SEP = '::';

/**
 * Build the unique store+variation mapping key. Returns null when either part
 * is missing so callers fall back to the coarse label rather than storing a
 * half-formed key.
 */
export function buildProductMappingKey(
  storeId: string | null | undefined,
  variationId: string | null | undefined,
): string | null {
  const s = storeId?.trim();
  const v = variationId?.trim();
  if (!s || !v) return null;
  return `${PREFIX}${SEP}${s}${SEP}${v}`.toLowerCase();
}

/**
 * Parse a mapping value back into its store + variation parts. Returns null for
 * coarse labels (the common case), so display code can fall through to showing
 * the label as-is.
 */
export function parseProductMappingKey(
  mapping: string | null | undefined,
): { storeId: string; variationId: string } | null {
  if (!mapping) return null;
  const parts = mapping.split(SEP);
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const storeId = parts[1]?.trim();
  const variationId = parts[2]?.trim();
  if (!storeId || !variationId) return null;
  return { storeId, variationId };
}

/**
 * Build the store-scoped "unassigned" key for an unmatched POS order that could
 * not be pinned to any product. Storing the store (instead of a bare null) keeps
 * each store's unmatched sales in their own bucket, shown as
 * "Unassigned — {store name}", rather than one anonymous pile.
 */
export function buildUnassignedMappingKey(
  storeId: string | null | undefined,
): string | null {
  const s = storeId?.trim();
  if (!s) return null;
  return `${UNASSIGNED_PREFIX}${SEP}${s}`.toLowerCase();
}

/** Parse an unassigned key back to its storeId; null for anything else. */
export function parseUnassignedMappingKey(
  mapping: string | null | undefined,
): { storeId: string } | null {
  if (!mapping) return null;
  const parts = mapping.split(SEP);
  if (parts.length !== 2 || parts[0] !== UNASSIGNED_PREFIX) return null;
  const storeId = parts[1]?.trim();
  if (!storeId) return null;
  return { storeId };
}

/** The minimal Prisma surface the display resolver needs (kept narrow for tests). */
type MappingDisplayDb = {
  posProduct: {
    findMany(args: {
      where: { OR: Array<{ storeId: string; variationId: string }> };
      select: { storeId: true; variationId: true; name: true };
    }): Promise<Array<{ storeId: string; variationId: string | null; name: string }>>;
  };
  posStore: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true };
    }): Promise<Array<{ id: string; name: string }>>;
  };
};

/**
 * Rewrite pv:: keys in a mapping display map to their product names and ua::
 * keys to "Unassigned — {store name}". Coarse labels are left untouched. Used by
 * every analytics endpoint that returns a mappingsDisplayMap, so all pages show
 * the same names for the same keys.
 */
export async function resolveMappingDisplayNames(
  db: MappingDisplayDb,
  mappingDisplayMap: Record<string, string>,
): Promise<void> {
  const productKeys = new Map<string, { storeId: string; variationId: string }>();
  const unassignedKeys = new Map<string, string>();
  for (const norm of Object.keys(mappingDisplayMap)) {
    const product = parseProductMappingKey(norm);
    if (product) {
      productKeys.set(norm, product);
      continue;
    }
    const unassigned = parseUnassignedMappingKey(norm);
    if (unassigned) unassignedKeys.set(norm, unassigned.storeId);
  }

  if (productKeys.size > 0) {
    const products = await db.posProduct.findMany({
      where: {
        OR: [...productKeys.values()].map((k) => ({
          storeId: k.storeId,
          variationId: k.variationId,
        })),
      },
      select: { storeId: true, variationId: true, name: true },
    });
    const nameByStoreVariation = new Map<string, string>();
    for (const p of products) {
      if (p.variationId) {
        nameByStoreVariation.set(
          `${p.storeId.toLowerCase()}${SEP}${p.variationId.toLowerCase()}`,
          p.name,
        );
      }
    }
    for (const [norm, parsed] of productKeys) {
      const name = nameByStoreVariation.get(`${parsed.storeId}${SEP}${parsed.variationId}`);
      if (name) mappingDisplayMap[norm] = name;
    }
  }

  if (unassignedKeys.size > 0) {
    const stores = await db.posStore.findMany({
      where: { id: { in: [...new Set(unassignedKeys.values())] } },
      select: { id: true, name: true },
    });
    const storeNameById = new Map(stores.map((s) => [s.id.toLowerCase(), s.name]));
    for (const [norm, storeId] of unassignedKeys) {
      const storeName = storeNameById.get(storeId);
      mappingDisplayMap[norm] = storeName ? `Unassigned — ${storeName}` : 'Unassigned';
    }
  }
}
