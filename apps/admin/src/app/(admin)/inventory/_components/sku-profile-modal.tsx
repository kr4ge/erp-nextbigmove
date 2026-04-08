"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type {
  UpsertWmsSkuProfileInput,
  WmsPosProductCatalogItem,
} from "../_types/inventory";
import { SkuProfileForm } from "./sku-profile-form";

type SkuProfileModalProps = {
  open: boolean;
  product: WmsPosProductCatalogItem | null;
  value: UpsertWmsSkuProfileInput;
  onChange: (next: UpsertWmsSkuProfileInput) => void;
  onClose: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
};

export function SkuProfileModal({
  open,
  product,
  value,
  onChange,
  onClose,
  onSubmit,
  onDelete,
  isSaving,
  isDeleting,
}: SkuProfileModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
          <div className="flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                  Inventory Product
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                  {product?.skuProfile ? "Edit Warehouse Profile" : "Create Warehouse Profile"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Set warehouse rules here. Unique unit labels are generated later when stock is received.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-orange-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto">
              <SkuProfileForm
                product={product}
                value={value}
                onChange={onChange}
                onSubmit={onSubmit}
                onDelete={onDelete}
                isSaving={isSaving}
                isDeleting={isDeleting}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
