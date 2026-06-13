'use client';

import { useEffect, useMemo, useState } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsInventoryUnitRecord } from '../_types/inventory';
import { formatInventoryStatusLabel } from '../_utils/inventory-status-presenters';

type InventoryBulkArchiveModalProps = {
  open: boolean;
  units: WmsInventoryUnitRecord[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (notes?: string) => Promise<void>;
};

export function InventoryBulkArchiveModal({
  open,
  units,
  isSubmitting,
  onClose,
  onSubmit,
}: InventoryBulkArchiveModalProps) {
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNotes('');
      setErrorMessage(null);
      return;
    }

    setErrorMessage(null);
  }, [open, units]);

  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const unit of units) {
      const label = formatInventoryStatusLabel(unit.status);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, count]) => `${count} ${label}`)
      .join(' · ');
  }, [units]);

  const previewUnits = units.slice(0, 6);
  const remainingPreviewCount = Math.max(units.length - previewUnits.length, 0);

  const handleSubmit = async () => {
    try {
      setErrorMessage(null);
      await onSubmit(notes.trim() || undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to archive selected units');
    }
  };

  return (
    <WmsModal
      open={open}
      title="Archive selected units"
      description={`${units.length} selected unit${units.length === 1 ? '' : 's'}`}
      onClose={onClose}
      panelClassName="max-w-[720px]"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-4 text-[13px] font-semibold text-[#4d6677] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={units.length === 0 || isSubmitting}
            className="inline-flex h-10 items-center rounded-[12px] bg-rose-600 px-4 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Archiving…' : `Archive ${units.length}`}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-[16px] border border-[#e3eaf0] bg-[#fbfcfc] px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6f8290]">
            Summary
          </p>
          <p className="mt-2 text-[13px] font-medium text-primary">
            {statusSummary || 'No units selected'}
          </p>
          <p className="mt-2 text-[12px] text-[#637786]">
            Archiving removes the selected units from active stock and clears their current location. Reserved units will release their safe reservations automatically.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6f8290]">
            Units
          </p>
          <div className="rounded-[16px] border border-[#e3eaf0] bg-white">
            {previewUnits.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between gap-3 border-b border-[#edf2f6] px-4 py-3 text-[13px] last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-primary">{unit.code}</p>
                  <p className="truncate text-[11px] text-[#708391]">
                    {unit.name} · {unit.currentLocation?.label ?? 'No location'}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-[#708391]">
                  {formatInventoryStatusLabel(unit.status)}
                </span>
              </div>
            ))}
            {remainingPreviewCount > 0 ? (
              <div className="px-4 py-3 text-[12px] text-[#708391]">
                +{remainingPreviewCount} more unit{remainingPreviewCount === 1 ? '' : 's'}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6f8290]">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional note for this archive action"
            className="w-full rounded-[14px] border border-[#d7e0e7] bg-[#fbfcfc] px-3 py-2.5 text-[13px] text-primary outline-none transition placeholder:text-[#94a3b8] focus:border-[#96b4c3]"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </WmsModal>
  );
}
