"use client";

import type {
  UpsertWmsSkuProfileInput,
  WmsPosProductCatalogItem,
  WmsSkuProfileStatus,
} from "../_types/inventory";
import { ProductImage } from "./product-image";
import { SkuProfileStatusBadge } from "./sku-profile-status-badge";

const STATUS_OPTIONS: WmsSkuProfileStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
];

type SkuProfileFormProps = {
  product: WmsPosProductCatalogItem | null;
  value: UpsertWmsSkuProfileInput;
  onChange: (next: UpsertWmsSkuProfileInput) => void;
  onSubmit: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

function fieldClassName() {
  return "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100";
}

function MetaPill({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-sm text-slate-800 ${mono ? "truncate font-mono text-xs" : "font-medium"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function SkuProfileForm({
  product,
  value,
  onChange,
  onSubmit,
  onDelete,
  isSaving,
  isDeleting,
}: SkuProfileFormProps) {
  if (!product) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-950">
          Select a product
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Choose a POS variant to configure its warehouse profile.
        </p>
      </div>
    );
  }

  const hasProfile = Boolean(product.skuProfile);

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(255,247,237,0.88)_36%,rgba(255,255,255,1)_100%)] px-6 py-5">
        <div className="flex items-start gap-4">
          <ProductImage
            imageUrl={product.imageUrl}
            name={product.name}
            className="h-16 w-16 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="line-clamp-2 text-base font-semibold text-slate-950">
                {product.name}
              </p>
              {product.skuProfile ? (
                <SkuProfileStatusBadge status={product.skuProfile.status} />
              ) : (
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  No profile
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MetaPill
                label="Variant"
                value={product.variationId || "No variation id"}
                mono
              />
              <MetaPill
                label="Variation Ref"
                value={product.variationCustomId || "No variation ref"}
              />
              <MetaPill
                label="Price"
                value={
                  product.retailPrice != null
                    ? `PHP ${product.retailPrice.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : "Not set"
                }
              />
              <MetaPill label="Tenant" value={product.store.tenant.name} />
              <MetaPill
                label="Shop"
                value={`${product.store.name} · ${product.store.shopName || product.store.shopId}`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-8 px-6 py-6">
          <section className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Identity
              </div>
              <div className="text-sm text-slate-600">
                Warehouse-facing codes and profile state.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  WMS SKU Code
                </label>
                <input
                  value={value.code || ""}
                  onChange={(event) =>
                    onChange({ ...value, code: event.target.value })
                  }
                  placeholder={product.variationId || "Warehouse code"}
                  className={fieldClassName()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  SKU Reference Barcode
                </label>
                <input
                  value={value.barcode || ""}
                  onChange={(event) =>
                    onChange({ ...value, barcode: event.target.value })
                  }
                  placeholder="Scanner-ready barcode"
                  className={fieldClassName()}
                />
                <p className="text-xs text-slate-500">
                  Optional item-family barcode. Individual unit labels are generated during receipt.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Category
                </label>
                <input
                  value={value.category || ""}
                  onChange={(event) =>
                    onChange({ ...value, category: event.target.value })
                  }
                  placeholder="Grouping"
                  className={fieldClassName()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Status
                </label>
                <select
                  value={value.status || "ACTIVE"}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      status: event.target.value as WmsSkuProfileStatus,
                    })
                  }
                  className={fieldClassName()}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-200 pt-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Storage + Handling
              </div>
              <div className="text-sm text-slate-600">
                Defaults for receiving, stock control, and scan operations.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Unit
                </label>
                <input
                  value={value.unit || ""}
                  onChange={(event) =>
                    onChange({ ...value, unit: event.target.value })
                  }
                  placeholder="pcs, box, pack"
                  className={fieldClassName()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Pack Size
                </label>
                <input
                  value={value.packSize || ""}
                  onChange={(event) =>
                    onChange({ ...value, packSize: event.target.value })
                  }
                  placeholder="12 pcs / box"
                  className={fieldClassName()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Description
              </label>
              <textarea
                value={value.description || ""}
                onChange={(event) =>
                  onChange({ ...value, description: event.target.value })
                }
                placeholder="Packaging, shelf, or handling notes"
                className={`${fieldClassName()} min-h-[112px]`}
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-200 pt-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Request Pricing
              </div>
              <div className="text-sm text-slate-600">
                Set the supplier cost and WMS sell price used by partner stock requests and invoices.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Supplier COGS
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={value.supplierCost ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      supplierCost: Number(event.target.value) || 0,
                    })
                  }
                  className={fieldClassName()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  WMS Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={value.wmsUnitPrice ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      wmsUnitPrice: Number(event.target.value) || 0,
                    })
                  }
                  className={fieldClassName()}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50/70 px-6 py-6 lg:border-l lg:border-t-0">
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Tracking
              </div>
              <div className="text-sm text-slate-600">
                Turn on batch or expiry controls only when operations require them.
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <input
                type="checkbox"
                checked={value.isSerialized ?? true}
                onChange={(event) =>
                  onChange({ ...value, isSerialized: event.target.checked })
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Serialized units
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Generate one unique unit barcode for every received piece.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <input
                type="checkbox"
                checked={Boolean(value.isRequestable)}
                onChange={(event) =>
                  onChange({ ...value, isRequestable: event.target.checked })
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Requestable by partner
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Include this product in forecast-driven stock requests and invoice generation.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <input
                type="checkbox"
                checked={Boolean(value.isLotTracked)}
                onChange={(event) =>
                  onChange({ ...value, isLotTracked: event.target.checked })
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Lot tracked
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Batch-based receiving and ledger traceability.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <input
                type="checkbox"
                checked={Boolean(value.isExpiryTracked)}
                onChange={(event) =>
                  onChange({ ...value, isExpiryTracked: event.target.checked })
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Expiry tracked
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Capture shelf-life during inbound posting.
                </span>
              </span>
            </label>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="text-sm text-slate-500">
          {hasProfile
            ? "Profile updates apply to future warehouse operations."
            : "Create the profile once, then use it across receipts, units, and fulfillment."}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : hasProfile
                ? "Update Profile"
                : "Create Profile"}
          </button>
          {hasProfile ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Removing..." : "Remove Profile"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
