"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { WmsPosProductCatalogItem } from "../_types/inventory";
import { ProductImage } from "./product-image";
import { SkuProfileStatusBadge } from "./sku-profile-status-badge";

type ProductsTableProps = {
  products: WmsPosProductCatalogItem[];
  activeProductId?: string | null;
  onManage: (productId: string) => void;
  formatMoney: (value: number | null) => string;
};

export function ProductsTable({
  products,
  activeProductId,
  onManage,
  formatMoney,
}: ProductsTableProps) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
          <colgroup>
            <col className="w-[31%]" />
            <col className="w-[13%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="border-y border-slate-200 bg-slate-50/70">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <th className="px-4 py-3.5">Product</th>
              <th className="px-4 py-3.5 text-center">Variant</th>
              <th className="px-4 py-3.5">Store</th>
              <th className="px-4 py-3.5">Profile</th>
              <th className="px-4 py-3.5 text-center">Price</th>
              <th className="px-4 py-3.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {products.map((product) => {
              const isSelected = product.id === activeProductId;

              return (
                <tr
                  key={product.id}
                  aria-selected={isSelected}
                  onClick={() => onManage(product.id)}
                  className={cn(
                    "cursor-pointer align-top transition hover:bg-slate-50/80",
                    isSelected && "bg-orange-50/70",
                  )}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <ProductImage
                        imageUrl={product.imageUrl}
                        name={product.name}
                        className="h-11 w-11 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-[15px] font-semibold leading-5 text-slate-950">
                          {product.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                      {product.variationCustomId || "No ref"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {product.store.tenant.name}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {product.store.name} ·{" "}
                        {product.store.shopName || product.store.shopId}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {product.skuProfile ? (
                      <div className="space-y-2">
                        <SkuProfileStatusBadge status={product.skuProfile.status} />
                        <div className="space-y-1 text-xs text-slate-500">
                          <div className="truncate">
                            {product.skuProfile.code || "Code not set"}
                          </div>
                          <div>
                            {product.skuProfile.isSerialized
                              ? "Serialized on receipt"
                              : "Quantity-tracked"}
                          </div>
                          <div>
                            {product.skuProfile.isRequestable
                              ? "Requestable by partner"
                              : "Internal only"}
                          </div>
                          <div className="font-medium text-slate-700">
                            WMS {formatMoney(product.skuProfile.wmsUnitPrice)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                        Not configured
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center font-semibold tabular-nums text-slate-950">
                    {formatMoney(product.retailPrice)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onManage(product.id);
                        }}
                        className={cn(
                          "inline-flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-semibold transition-colors",
                          isSelected
                            ? "border-orange-200 bg-orange-100 text-orange-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700",
                        )}
                      >
                        {isSelected
                          ? "Open"
                          : product.skuProfile
                            ? "Edit"
                            : "Configure"}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
