import { Prisma } from '@prisma/client';

export type ForecastStoreRef = {
  id: string;
  tenantId: string;
  shopId: string;
};

export type ForecastCatalogProduct = {
  storeId: string;
  productId: string;
  variationId: string | null;
  customId: string | null;
  name: string;
};

export type ForecastPosOrderSource = {
  tenantId: string;
  shopId: string;
  orderSnapshot: Prisma.JsonValue | null;
  itemData: Prisma.JsonValue | null;
};

export type ForecastItemAggregate = {
  rowId: string;
  storeId: string;
  variationId: string;
  productId: string | null;
  productName: string;
  productDisplayId: string | null;
  quantity: number;
};

type ProductMaps = {
  byVariationId: Map<string, ForecastCatalogProduct>;
  byProductId: Map<string, ForecastCatalogProduct>;
  byCustomId: Map<string, ForecastCatalogProduct>;
};

export function aggregateForecastPosOrderItems(params: {
  orders: ForecastPosOrderSource[];
  stores: ForecastStoreRef[];
  catalogProducts: ForecastCatalogProduct[];
}) {
  const storeByTenantShop = new Map(
    params.stores.map((store) => [`${store.tenantId}:${store.shopId}`, store] as const),
  );
  const productMapsByStore = buildProductMaps(params.catalogProducts);
  const aggregate = new Map<string, ForecastItemAggregate>();

  for (const order of params.orders) {
    const store = storeByTenantShop.get(`${order.tenantId}:${order.shopId}`);
    if (!store) {
      continue;
    }

    const productMaps = productMapsByStore.get(store.id) ?? {
      byVariationId: new Map(),
      byProductId: new Map(),
      byCustomId: new Map(),
    };

    for (const rawItem of extractOrderItems(order)) {
      const item = asJsonRecord(rawItem);
      if (!item) {
        continue;
      }

      const variationInfo = asJsonRecord(item.variation_info);
      const sourceVariationId = readString(item.variation_id) ?? readString(item.variationId);
      const sourceProductId = readString(item.product_id)
        ?? readString(item.productId)
        ?? readString(item.product_id);
      const sourceDisplayIds = [
        readString(item.product_display_id),
        readString(item.productDisplayId),
        readString(variationInfo?.product_display_id),
        readString(variationInfo?.display_id),
        readString(variationInfo?.barcode),
      ].filter(Boolean) as string[];
      const resolvedProduct =
        (sourceVariationId ? productMaps.byVariationId.get(sourceVariationId) : null)
        ?? (sourceProductId ? productMaps.byProductId.get(sourceProductId) : null)
        ?? sourceDisplayIds.map((id) => productMaps.byCustomId.get(id)).find(Boolean)
        ?? null;
      const variationId = sourceVariationId ?? resolvedProduct?.variationId ?? null;
      if (!variationId) {
        continue;
      }

      const quantity = readPositiveInt(item.quantity ?? item.qty);
      if (quantity <= 0) {
        continue;
      }

      const productId = resolvedProduct?.productId ?? sourceProductId ?? null;
      const productName =
        readString(variationInfo?.name)
        ?? readString(item.variationName)
        ?? resolvedProduct?.name
        ?? readString(item.note_product)
        ?? `Variation ${variationId}`;
      const productDisplayId =
        resolvedProduct?.customId
        ?? readString(item.productDisplayId)
        ?? readString(item.product_display_id)
        ?? readString(variationInfo?.display_id)
        ?? readString(variationInfo?.product_display_id)
        ?? readString(variationInfo?.barcode);

      const rowId = `${store.id}:${variationId}`;
      const existing = aggregate.get(rowId);
      if (existing) {
        existing.quantity += quantity;
        continue;
      }

      aggregate.set(rowId, {
        rowId,
        storeId: store.id,
        variationId,
        productId,
        productName,
        productDisplayId,
        quantity,
      });
    }
  }

  return aggregate;
}

function buildProductMaps(products: ForecastCatalogProduct[]) {
  const maps = new Map<string, ProductMaps>();

  for (const product of products) {
    const existing = maps.get(product.storeId) ?? {
      byVariationId: new Map<string, ForecastCatalogProduct>(),
      byProductId: new Map<string, ForecastCatalogProduct>(),
      byCustomId: new Map<string, ForecastCatalogProduct>(),
    };

    if (product.variationId) {
      existing.byVariationId.set(product.variationId, product);
    }
    existing.byProductId.set(product.productId, product);
    if (product.customId) {
      existing.byCustomId.set(product.customId, product);
    }

    maps.set(product.storeId, existing);
  }

  return maps;
}

function extractOrderItems(order: ForecastPosOrderSource) {
  const snapshot = asJsonRecord(order.orderSnapshot);
  if (Array.isArray(snapshot?.items)) {
    return snapshot.items;
  }

  if (Array.isArray(order.itemData)) {
    return order.itemData;
  }

  return [];
}

function asJsonRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveInt(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(Math.trunc(parsed), 0);
}
