'use client';

import clsx from 'clsx';
import { Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormSelect } from '@/components/ui/form-select';
import { FormTextarea } from '@/components/ui/form-textarea';
import { RequestsSearchableSelect } from './requests-searchable-select';
import type {
  WmsPurchasingProductOption,
  WmsPurchasingProductOptionsResponse,
  WmsPurchasingRequestType,
} from '../_types/request';

type CartLine = {
  id: string;
  product: WmsPurchasingProductOption;
  quantity: number;
};

interface RequestCreatePanelProps {
  stores: Array<{ id: string; label: string }>;
  createStoreScopeId: string;
  createRequestType: WmsPurchasingRequestType;
  createPartnerNotes: string;
  cartLines: CartLine[];
  cartTotals: {
    totalItems: number;
    totalAmount: number;
  };
  isSubmitting: boolean;
  isProductPickerOpen: boolean;
  productSearchText: string;
  productOptions: WmsPurchasingProductOptionsResponse | null;
  isLoadingProductOptions: boolean;
  productOptionsError: string | null;
  productOptionsPage: number;
  effectiveStoreId?: string;
  onStoreScopeChange: (value: string) => void;
  onRequestTypeChange: (value: WmsPurchasingRequestType) => void;
  onPartnerNotesChange: (value: string) => void;
  onOpenProductPicker: () => void;
  onCloseProductPicker: () => void;
  onProductSearchChange: (value: string) => void;
  onProductOptionsPageChange: (page: number) => void;
  onAddProduct: (product: WmsPurchasingProductOption) => void;
  onRemoveLine: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onSubmit: () => Promise<void>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getLineUnitAmount(product: WmsPurchasingProductOption, requestType: WmsPurchasingRequestType) {
  if (requestType === 'PROCUREMENT') {
    return product.inhouseUnitCost ?? 0;
  }
  return product.inhouseUnitCost ?? 0;
}

export function RequestCreatePanel({
  stores,
  createStoreScopeId,
  createRequestType,
  createPartnerNotes,
  cartLines,
  cartTotals,
  isSubmitting,
  isProductPickerOpen,
  productSearchText,
  productOptions,
  isLoadingProductOptions,
  productOptionsError,
  productOptionsPage,
  effectiveStoreId,
  onStoreScopeChange,
  onRequestTypeChange,
  onPartnerNotesChange,
  onOpenProductPicker,
  onCloseProductPicker,
  onProductSearchChange,
  onProductOptionsPageChange,
  onAddProduct,
  onRemoveLine,
  onQuantityChange,
  onSubmit,
}: RequestCreatePanelProps) {
  const totalPages = productOptions?.pagination.totalPages ?? 1;
  const effectiveStoreName = effectiveStoreId
    ? stores.find((store) => store.id === effectiveStoreId)?.label ?? 'Selected store'
    : 'All stores';

  return (
    <Card className="border-slate-200 bg-white">
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Stock Request Cart</h2>
            <p className="text-xs text-slate-500">Select products and submit to WMS</p>
          </div>
          <Button
            size="sm"
            onClick={() => void onSubmit()}
            loading={isSubmitting}
            disabled={isSubmitting || cartLines.length === 0}
          >
            Submit request
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Store</label>
            <RequestsSearchableSelect
              label="Store"
              value={createStoreScopeId}
              onChange={onStoreScopeChange}
              options={stores.map((store) => ({ value: store.id, label: store.label }))}
              allLabel="All stores"
              placeholder="Search stores..."
            />
          </div>
          <FormSelect
            label="Request type"
            value={createRequestType}
            onChange={(event) => onRequestTypeChange(event.target.value as WmsPurchasingRequestType)}
            className="rounded-lg px-3 py-1.5 text-sm"
            options={[
              { value: 'PROCUREMENT', label: 'Procurement' },
              { value: 'SELF_BUY', label: 'Self-buy' },
            ]}
          />
        </div>

        <p className="text-xs text-slate-500">
          Scope: <span className="font-semibold text-slate-700">{effectiveStoreName}</span>
        </p>

        {cartLines.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                <tr>
                  <th className="px-2.5 py-1.5">Product</th>
                  <th className="px-2.5 py-1.5">Store</th>
                  <th className="px-2.5 py-1.5">Unit amount</th>
                  <th className="px-2.5 py-1.5">Qty</th>
                  <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                  <th className="px-2.5 py-1.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {cartLines.map((line) => {
                  const unitAmount = getLineUnitAmount(line.product, createRequestType);
                  const subtotal = unitAmount * line.quantity;
                  return (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2">
                        <p className="font-semibold text-slate-800">{line.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {line.product.variationDisplayId || line.product.variationId || 'No variation'}
                        </p>
                      </td>
                      <td className="px-2.5 py-2 text-slate-800">{line.product.store.name}</td>
                      <td className="px-2.5 py-2 font-semibold text-slate-800">
                        {formatCurrency(unitAmount)}
                      </td>
                      <td className="px-2.5 py-2">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) =>
                            onQuantityChange(line.id, Number.parseInt(event.target.value, 10))
                          }
                          className="h-8 w-16 rounded-md border border-slate-200 px-2 text-sm text-slate-800 outline-none focus:border-slate-300"
                        />
                      </td>
                      <td className="px-2.5 py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(subtotal)}
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveLine(line.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpenProductPicker}
          disabled={isSubmitting}
          className="group w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-sm font-medium tracking-tight text-slate-600">
            Drag products here
          </span>
          <span className="px-1.5 text-sm font-medium text-slate-500">or</span>
          <span className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">
            Add product
          </span>
        </button>

        {isProductPickerOpen ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center gap-2">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  placeholder={
                    effectiveStoreId
                      ? 'Search products in selected store...'
                      : 'Search products across all stores...'
                  }
                  value={productSearchText}
                  onChange={(event) => onProductSearchChange(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={onCloseProductPicker}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2.5 max-h-[280px] overflow-auto rounded-lg border border-slate-200 bg-white">
              {isLoadingProductOptions ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">Loading products...</div>
              ) : productOptionsError ? (
                <div className="px-3 py-8 text-center text-sm text-rose-700">{productOptionsError}</div>
              ) : (productOptions?.products.length ?? 0) === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">No products found</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {productOptions?.products.map((product) => (
                    <li key={product.profileId}>
                      <button
                        type="button"
                        onClick={() => onAddProduct(product)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            {product.variationDisplayId || product.variationId || 'No variation'} · {product.store.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatCurrency(getLineUnitAmount(product, createRequestType))}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {product.inhouseUnitCost === null ? 'COGS not set' : 'Unit amount'}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onProductOptionsPageChange(productOptionsPage - 1)}
                disabled={productOptionsPage <= 1}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500">
                {productOptionsPage} / {Math.max(1, totalPages)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onProductOptionsPageChange(productOptionsPage + 1)}
                disabled={productOptionsPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}

        <FormTextarea
          label="Notes"
          placeholder="Optional note for WMS reviewer"
          value={createPartnerNotes}
          onChange={(event) => onPartnerNotesChange(event.target.value)}
          maxLength={400}
          rows={2}
          className="rounded-lg px-3 py-1.5"
        />

        {cartLines.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard
              label="Selected products"
              value={String(cartLines.length)}
            />
            <SummaryCard
              label="Total quantity"
              value={String(cartTotals.totalItems)}
            />
            <SummaryCard
              label="Total amount"
              value={formatCurrency(cartTotals.totalAmount)}
              valueClassName="text-slate-900"
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={clsx('mt-0.5 text-lg font-semibold text-slate-800', valueClassName)}>{value}</p>
    </div>
  );
}
