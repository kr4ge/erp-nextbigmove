'use client';

import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type { WmsReceivablePurchasingBatch } from '../_types/receiving';

type ReceivingBatchModalProps = {
  open: boolean;
  batch: WmsReceivablePurchasingBatch | null;
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
  lineQuantities: Record<string, number>;
  totalUnits: number;
  isSubmitting: boolean;
  onClose: () => void;
  onWarehouseChange: (value: string) => void;
  onStagingLocationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onLineQuantityChange: (lineId: string, quantity: number) => void;
  onSubmit: () => Promise<void>;
};

export function ReceivingBatchModal({
  open,
  batch,
  warehouseOptions,
  warehouseId,
  stagingLocationId,
  notes,
  lineQuantities,
  totalUnits,
  isSubmitting,
  onClose,
  onWarehouseChange,
  onStagingLocationChange,
  onNotesChange,
  onLineQuantityChange,
  onSubmit,
}: ReceivingBatchModalProps) {
  const activeWarehouse = useMemo(
    () => warehouseOptions.find((option) => option.id === warehouseId) ?? null,
    [warehouseId, warehouseOptions],
  );

  if (!open || !batch) {
    return null;
  }

  return (
    <WmsModal
      open={open}
      title={batch.sourceRequestId || batch.requestTitle || 'Receive Purchasing Batch'}
      description={`${batch.store.name} · ${batch.remainingQuantity} remaining units`}
      onClose={onClose}
      footer={
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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create receiving batch'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc]">
            <div className="border-b border-[#e7edf2] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
                Receiving Lines
              </p>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              <table className="min-w-full divide-y divide-[#eef2f5]">
                <thead className="bg-white">
                  <tr>
                    <HeaderCell>Item</HeaderCell>
                    <HeaderCell className="text-right">Remaining</HeaderCell>
                    <HeaderCell className="text-right">Receive</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f5]">
                  {batch.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <div className="max-w-[340px]">
                          <p className="truncate text-sm font-semibold text-[#12384b]">
                            {line.requestedProductName || line.variationId || line.productId || `Line ${line.lineNo}`}
                          </p>
                          <p className="mt-1 truncate text-[12px] text-[#7b8e9c]">
                            {line.resolvedPosProduct?.customId || line.resolvedPosProduct?.name || 'Resolved product required'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#12384b]">
                        {line.remainingQuantity}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={line.remainingQuantity}
                          value={lineQuantities[line.id] ?? 0}
                          onChange={(event) => onLineQuantityChange(line.id, Number(event.target.value))}
                          className="h-9 w-24 rounded-[12px] border border-[#d7e0e7] bg-white px-3 text-right text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              placeholder="Optional receiving notes, audit context, or staging instructions"
              className="mt-2 w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-[#12384b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
            />
          </div>
        </div>
      </div>
    </WmsModal>
  );
}

function HeaderCell({ children, className = '' }: { children: string; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c] ${className}`}
    >
      {children}
    </th>
  );
}
