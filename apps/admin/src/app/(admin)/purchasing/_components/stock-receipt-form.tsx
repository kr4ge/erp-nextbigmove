'use client';

import { Plus, Trash2 } from 'lucide-react';
import { WmsProfiledProductSelect } from '../../_components/wms-profiled-product-select';
import { buildProfiledProductLinePatch } from '../../_utils/wms-profiled-products';
import type { WmsPosProductCatalogItem } from '../../inventory/_types/inventory';
import type { WmsWarehouse } from '../../warehouses/_types/warehouses';
import type { CreateWmsStockReceiptInput } from '../_types/purchasing';

type StockReceiptFormProps = {
  warehouses: WmsWarehouse[];
  profiledProducts: WmsPosProductCatalogItem[];
  value: CreateWmsStockReceiptInput;
  disabled?: boolean;
  onChange: (value: CreateWmsStockReceiptInput) => void;
  onSubmit: () => void;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyReceiptForm(): CreateWmsStockReceiptInput {
  return {
    requestId: '',
    warehouseId: '',
    locationId: '',
    supplierName: '',
    supplierReference: '',
    receivedAt: todayYmd(),
    currency: 'PHP',
    notes: '',
    items: [
      {
        requestLineId: '',
        sku: '',
        productName: '',
        variationName: '',
        barcode: '',
        quantity: 1,
        unitCost: 0,
        lotCode: '',
        supplierBatchNo: '',
      },
    ],
  };
}

export function StockReceiptForm({
  warehouses,
  profiledProducts,
  value,
  disabled,
  onChange,
  onSubmit,
}: StockReceiptFormProps) {
  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === value.warehouseId) || null;
  const receivingLocations = (selectedWarehouse?.locations || []).filter(
    (location) => location.status === 'ACTIVE' && ['RECEIVING', 'STORAGE'].includes(location.type),
  );

  const setField = <K extends keyof CreateWmsStockReceiptInput>(
    key: K,
    nextValue: CreateWmsStockReceiptInput[K],
  ) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  const updateItem = (index: number, patch: Partial<CreateWmsStockReceiptInput['items'][number]>) => {
    const nextItems = value.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    onChange({
      ...value,
      items: nextItems,
    });
  };

  const addItem = () => {
    onChange({
      ...value,
      items: [
        ...value.items,
        {
          requestLineId: '',
          sku: '',
          productName: '',
          variationName: '',
          barcode: '',
          quantity: 1,
          unitCost: 0,
          lotCode: '',
          supplierBatchNo: '',
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (value.items.length === 1) {
      return;
    }

    onChange({
      ...value,
      items: value.items.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Warehouse</span>
          <select
            value={value.warehouseId}
            disabled={disabled}
            onChange={(event) => {
              const warehouseId = event.target.value;
              const warehouse = warehouses.find((item) => item.id === warehouseId);
              const nextLocation =
                warehouse?.locations.find(
                  (location) =>
                    location.status === 'ACTIVE' &&
                    ['RECEIVING', 'STORAGE'].includes(location.type),
                ) || null;

              onChange({
                ...value,
                warehouseId,
                locationId: nextLocation?.id || '',
              });
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
          >
            <option value="">Select warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Location</span>
          <select
            value={value.locationId}
            disabled={disabled || !selectedWarehouse}
            onChange={(event) => setField('locationId', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
          >
            <option value="">Select location</option>
            {receivingLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Supplier</span>
          <input
            value={value.supplierName || ''}
            disabled={disabled}
            onChange={(event) => setField('supplierName', event.target.value)}
            placeholder="Optional"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reference</span>
          <input
            value={value.supplierReference || ''}
            disabled={disabled}
            onChange={(event) => setField('supplierReference', event.target.value)}
            placeholder="PO or supplier ref"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Received Date</span>
          <input
            type="date"
            value={value.receivedAt || ''}
            disabled={disabled}
            onChange={(event) => setField('receivedAt', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Currency</span>
          <input
            value={value.currency || 'PHP'}
            disabled={disabled}
            onChange={(event) => setField('currency', event.target.value.toUpperCase())}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
          />
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</span>
        <textarea
          value={value.notes || ''}
          disabled={disabled}
          onChange={(event) => setField('notes', event.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
        />
      </label>

      <div className="space-y-3">
        {value.items.map((item, index) => (
          <div key={`receipt-item-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {(() => {
              const selectedProduct =
                profiledProducts.find((entry) => entry.id === item.sourceProductId) || null;
              const isSerialized = Boolean(selectedProduct?.skuProfile?.isSerialized);
              const isRequestLinked = Boolean(value.requestId && item.requestLineId);

              return (
                <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-4">
                <WmsProfiledProductSelect
                  products={profiledProducts}
                  value={item.sourceProductId}
                  disabled={disabled || isRequestLinked}
                  onChange={(productId) => {
                    if (!productId) {
                      updateItem(index, {
                        sourceProductId: '',
                        requestLineId: '',
                        sku: '',
                        productName: '',
                        variationId: undefined,
                        variationName: '',
                        barcode: '',
                      });
                      return;
                    }

                    const product = profiledProducts.find((entry) => entry.id === productId);
                    if (!product) {
                      return;
                    }

                    updateItem(index, buildProfiledProductLinePatch(product));
                  }}
                />
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">SKU</span>
                <input
                  value={item.sku}
                  disabled={disabled || isRequestLinked}
                  onChange={(event) => updateItem(index, { sku: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product</span>
                <input
                  value={item.productName}
                  disabled={disabled || isRequestLinked}
                  onChange={(event) => updateItem(index, { productName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Variation</span>
                <input
                  value={item.variationName || ''}
                  disabled={disabled || isRequestLinked}
                  onChange={(event) => updateItem(index, { variationName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Barcode</span>
                <input
                  value={item.barcode || ''}
                  disabled={disabled || isRequestLinked}
                  onChange={(event) => updateItem(index, { barcode: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Qty</span>
                <input
                  type="number"
                  min={isSerialized ? '1' : '0.0001'}
                  step={isSerialized ? '1' : '0.0001'}
                  value={item.quantity}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
                {isSerialized ? (
                  <p className="text-xs text-slate-500">
                    Serialized products must be received as whole units. One barcode will be generated per piece.
                  </p>
                ) : isRequestLinked ? (
                  <p className="text-xs text-slate-500">
                    This line is locked to an approved request item.
                  </p>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unit COGS</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitCost}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { unitCost: Number(event.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Lot Code</span>
                <input
                  value={item.lotCode || ''}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { lotCode: event.target.value })}
                  placeholder="Auto if blank"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Batch Ref</span>
                <input
                  value={item.supplierBatchNo || ''}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { supplierBatchNo: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                Line total:{' '}
                <span className="font-semibold text-slate-900">
                  {(item.quantity * item.unitCost).toLocaleString('en-PH', {
                    style: 'currency',
                    currency: value.currency || 'PHP',
                  })}
                </span>
              </div>
              <button
                type="button"
                disabled={disabled || value.items.length === 1 || Boolean(value.requestId)}
                onClick={() => removeItem(index)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={disabled || Boolean(value.requestId)}
          onClick={addItem}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add line
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Post receipt
        </button>
      </div>
    </div>
  );
}
