import type { WmsPosProductCatalogItem } from "../inventory/_types/inventory";

export function resolveProfiledProductSku(product: WmsPosProductCatalogItem) {
  return product.skuProfile?.code || product.variationId || "";
}

export function resolveProfiledProductVariationName(
  product: WmsPosProductCatalogItem,
) {
  return product.variationCustomId || product.customId || product.mapping || undefined;
}

export function resolveProfiledProductBarcode(
  product: WmsPosProductCatalogItem,
) {
  return product.skuProfile?.barcode || undefined;
}

export function buildProfiledProductOptionLabel(
  product: WmsPosProductCatalogItem,
) {
  const sku = resolveProfiledProductSku(product);
  const shop = product.store.shopName || product.store.shopId;
  const suffix = [product.store.tenant.name, shop].filter(Boolean).join(" · ");
  return [product.name, sku ? `SKU ${sku}` : null, suffix]
    .filter(Boolean)
    .join(" — ");
}

export function buildProfiledProductLinePatch(
  product: WmsPosProductCatalogItem,
) {
  return {
    sourceProductId: product.id,
    sku: resolveProfiledProductSku(product),
    productName: product.name,
    variationId: product.variationId || undefined,
    variationName: resolveProfiledProductVariationName(product),
    barcode: resolveProfiledProductBarcode(product),
  };
}
