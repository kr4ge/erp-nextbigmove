"use client";

import type { WmsPosProductCatalogItem } from "../inventory/_types/inventory";
import {
  buildProfiledProductOptionLabel,
  resolveProfiledProductSku,
} from "../_utils/wms-profiled-products";

type WmsProfiledProductSelectProps = {
  products: WmsPosProductCatalogItem[];
  value?: string;
  disabled?: boolean;
  onChange: (productId: string) => void;
};

export function WmsProfiledProductSelect({
  products,
  value,
  disabled,
  onChange,
}: WmsProfiledProductSelectProps) {
  const selectedProduct =
    products.find((product) => product.id === value) || null;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Profiled Product
      </label>
      <select
        value={value || ""}
        disabled={disabled || products.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
      >
        <option value="">
          {products.length === 0
            ? "No profiled products yet"
            : "Select profiled product"}
        </option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {buildProfiledProductOptionLabel(product)}
          </option>
        ))}
      </select>
      {selectedProduct ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">
            {selectedProduct.name}
          </span>
          <span className="mx-2 text-slate-300">•</span>
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-slate-700">
            {resolveProfiledProductSku(selectedProduct)}
          </span>
          <span className="mx-2 text-slate-300">•</span>
          <span>{selectedProduct.store.name}</span>
        </div>
      ) : null}
    </div>
  );
}
