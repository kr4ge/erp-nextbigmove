'use client';

import { Plus, Trash2 } from 'lucide-react';
import { WmsProfiledProductSelect } from '../../_components/wms-profiled-product-select';
import { buildProfiledProductLinePatch } from '../../_utils/wms-profiled-products';
import type { WmsWarehouse } from '../../warehouses/_types/warehouses';
import type {
  CreateWmsInventoryAdjustmentInput,
  WmsPosProductCatalogItem,
} from '../_types/inventory';

type InventoryAdjustmentFormProps = {
  warehouses: WmsWarehouse[];
  profiledProducts: WmsPosProductCatalogItem[];
  value: CreateWmsInventoryAdjustmentInput;
  disabled?: boolean;
  onChange: (value: CreateWmsInventoryAdjustmentInput) => void;
  onSubmit: () => void;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyInventoryAdjustmentForm(): CreateWmsInventoryAdjustmentInput {
  return {
    warehouseId: '',
    locationId: '',
    adjustmentType: 'OPENING',
    reason: '',
    happenedAt: todayYmd(),
    currency: 'PHP',
    notes: '',
    items: [
      {
        sku: '',
        productName: '',
        variationName: '',
        barcode: '',
        quantity: 1,
        unitCost: 0,
        lotCode: '',
        notes: '',
      },
    ],
  };
}

export function InventoryAdjustmentForm({
  warehouses,
  profiledProducts,
  value,
  disabled,
  onChange,
  onSubmit,
}: InventoryAdjustmentFormProps) {
  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === value.warehouseId) || null;
  const activeLocations = (selectedWarehouse?.locations || []).filter(
    (location) => location.status === 'ACTIVE',
  );
  const isPositiveAdjustment =
    value.adjustmentType === 'OPENING' || value.adjustmentType === 'INCREASE';

  const setField = <K extends keyof CreateWmsInventoryAdjustmentInput>(
    key: K,
    nextValue: CreateWmsInventoryAdjustmentInput[K],
  ) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  const updateItem = (
    index: number,
    patch: Partial<CreateWmsInventoryAdjustmentInput['items'][number]>,
  ) => {
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
          sku: '',
          productName: '',
          variationName: '',
          barcode: '',
          quantity: 1,
          unitCost: isPositiveAdjustment ? 0 : undefined,
          lotCode: '',
          notes: '',
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
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Type</span>
          <select
            value={value.adjustmentType}
            disabled={disabled}
            onChange={(event) => {
              const adjustmentType = event.target.value as CreateWmsInventoryAdjustmentInput['adjustmentType'];
              const positive = adjustmentType === 'OPENING' || adjustmentType === 'INCREASE';
              onChange({
                ...value,
                adjustmentType,
                items: value.items.map((item) => ({
                  ...item,
                  unitCost: positive ? item.unitCost ?? 0 : undefined,
                  lotCode: positive ? item.lotCode : '',
                })),
              });
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
          >
            <option value="OPENING">Opening</option>
            <option value="INCREASE">Increase</option>
            <option value="DECREASE">Decrease</option>
            <option value="WRITE_OFF">Write Off</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Warehouse</span>
          <select
            value={value.warehouseId}
            disabled={disabled}
            onChange={(event) => {
              const warehouseId = event.target.value;
              const warehouse = warehouses.find((item) => item.id === warehouseId);
              const nextLocation =
                warehouse?.locations.find((location) => location.status === 'ACTIVE') || null;

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
            {activeLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date</span>
          <input
            type="date"
            value={value.happenedAt || ''}
            disabled={disabled}
            onChange={(event) => setField('happenedAt', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
          />
        </label>

        <label className="space-y-2 md:col-span-2 xl:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reason</span>
          <input
            value={value.reason}
            disabled={disabled}
            onChange={(event) => setField('reason', event.target.value)}
            placeholder="Opening stock, recount correction, write off"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
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

      <label className="block space-y-2">
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
          <div key={`adjustment-item-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className={`grid gap-4 ${isPositiveAdjustment ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
              <div className={isPositiveAdjustment ? 'md:col-span-2 xl:col-span-4' : 'md:col-span-2 xl:col-span-3'}>
                <WmsProfiledProductSelect
                  products={profiledProducts}
                  value={item.sourceProductId}
                  disabled={disabled}
                  onChange={(productId) => {
                    if (!productId) {
                      updateItem(index, {
                        sourceProductId: '',
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
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { sku: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Product</span>
                <input
                  value={item.productName}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { productName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Variation</span>
                <input
                  value={item.variationName || ''}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { variationName: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Barcode</span>
                <input
                  value={item.barcode || ''}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { barcode: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Qty</span>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={item.quantity}
                  disabled={disabled}
                  onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300"
                />
              </label>

              {isPositiveAdjustment ? (
                <>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unit COGS</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost ?? 0}
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
                </>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                {isPositiveAdjustment ? 'Cost impact' : 'Quantity impact'}:{' '}
                <span className="font-semibold text-slate-900">
                  {isPositiveAdjustment
                    ? (item.quantity * (item.unitCost ?? 0)).toLocaleString('en-PH', {
                        style: 'currency',
                        currency: value.currency || 'PHP',
                      })
                    : `${item.quantity.toLocaleString('en-US')} unit(s)`}
                </span>
              </div>
              <button
                type="button"
                disabled={disabled || value.items.length === 1}
                onClick={() => removeItem(index)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={disabled}
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
          Post adjustment
        </button>
      </div>
    </div>
  );
}
