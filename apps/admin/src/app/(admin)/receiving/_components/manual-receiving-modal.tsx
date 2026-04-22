'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';

type ManualReceivingLine = {
  id: string;
  profileId: string;
  quantity: number;
};

type ManualReceivingProductOption = {
  id: string;
  label: string;
  hint: string | number | null;
};

type ManualReceivingModalProps = {
  open: boolean;
  storeName: string | null;
  warehouseOptions: Array<{
    id: string;
    code: string;
    label: string;
    stagingLocations: Array<{
      id: string;
      code: string;
      label: string;
    }>;
  }>;
  warehouseId: string;
  stagingLocationId: string;
  notes: string;
  lines: ManualReceivingLine[];
  productOptions: ManualReceivingProductOption[];
  isLoadingProducts: boolean;
  isSubmitting: boolean;
  totalUnits: number;
  onClose: () => void;
  onWarehouseChange: (value: string) => void;
  onStagingLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAddLine: () => void;
  onRemoveLine: (id: string) => void;
  onProfileChange: (id: string, profileId: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onSubmit: () => Promise<void>;
};

export function ManualReceivingModal({
  open,
  storeName,
  warehouseOptions,
  warehouseId,
  stagingLocationId,
  notes,
  lines,
  productOptions,
  isLoadingProducts,
  isSubmitting,
  totalUnits,
  onClose,
  onWarehouseChange,
  onStagingLocationChange,
  onNotesChange,
  onAddLine,
  onRemoveLine,
  onProfileChange,
  onQuantityChange,
  onSubmit,
}: ManualReceivingModalProps) {
  const activeWarehouse = useMemo(
    () => warehouseOptions.find((option) => option.id === warehouseId) ?? null,
    [warehouseId, warehouseOptions],
  );

  if (!open) {
    return null;
  }

  return (
    <WmsModal
      open={open}
      title="Manual Stock Input"
      description={storeName ? `${storeName} · Create staged serialized units without a purchasing batch` : 'Create staged serialized units without a purchasing batch'}
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[#5f7483]">{totalUnits} units will be created in staging.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-3.5 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!warehouseId || !stagingLocationId || totalUnits <= 0 || isSubmitting}
              className="inline-flex h-9 items-center rounded-[12px] bg-[#12384b] px-4 text-[12px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create stock batch'}
            </button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc]">
            <div className="flex items-center justify-between border-b border-[#e7edf2] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
                Manual Lines
              </p>
              <button
                type="button"
                onClick={onAddLine}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e0e7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {isLoadingProducts ? (
                <p className="py-8 text-center text-sm text-[#708492]">Loading products…</p>
              ) : lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#708492]">Add a line to start manual stock input.</p>
              ) : (
                lines.map((line, index) => (
                  <div key={line.id} className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold text-[#12384b]">Line {index + 1}</p>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => onRemoveLine(line.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-[#f2d8d8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#b44b4b] transition hover:bg-[#fff4f4]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
                      <WmsSearchableSelect
                        label="Product"
                        value={line.profileId}
                        onChange={(value) => onProfileChange(line.id, value)}
                        options={productOptions.map((option) => ({
                          value: option.id,
                          label: option.label,
                          hint: option.hint ?? undefined,
                        }))}
                        placeholder="Search products…"
                        allLabel="Select product"
                        clearable={false}
                      />

                      <label className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a8f9d]">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(event) => onQuantityChange(line.id, Number(event.target.value))}
                          className="h-10 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3]"
                        />
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[18px] border border-[#dce4ea] bg-white px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Warehouse</p>
            <div className="mt-2">
              <WmsSearchableSelect
                label="Warehouse"
                value={warehouseId}
                onChange={onWarehouseChange}
                options={warehouseOptions.map((option) => ({
                  value: option.id,
                  label: `${option.code} · ${option.label}`,
                  hint: option.stagingLocations.length,
                }))}
                allLabel="Select warehouse"
                clearable={false}
              />
            </div>
          </div>

          <div className="rounded-[18px] border border-[#dce4ea] bg-white px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Staging</p>
            <div className="mt-2">
              <WmsSearchableSelect
                label="Staging"
                value={stagingLocationId}
                onChange={onStagingLocationChange}
                options={(activeWarehouse?.stagingLocations ?? []).map((location) => ({
                  value: location.id,
                  label: `${location.code} · ${location.label}`,
                }))}
                allLabel="Select staging"
                clearable={false}
              />
            </div>
          </div>

          <div className="rounded-[18px] border border-[#dce4ea] bg-white px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Notes</p>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              rows={4}
              placeholder="Optional intake notes or audit context"
              className="mt-2 w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
            />
          </div>
        </div>
      </div>
    </WmsModal>
  );
}
