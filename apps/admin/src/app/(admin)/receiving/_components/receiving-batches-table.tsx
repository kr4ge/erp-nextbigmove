'use client';

import type { WmsReceivingBatchRow } from '../_types/receiving';
import {
  formatReceivingStatusLabel,
  formatShortDate,
  getReceivingStatusClassName,
} from '../_utils/receiving-presenters';

type ReceivingBatchesTableProps = {
  batches: WmsReceivingBatchRow[];
  isLoading: boolean;
  onViewBatch: (batch: WmsReceivingBatchRow) => void;
  canTransferBatch?: boolean;
  onTransferBatch?: (batch: WmsReceivingBatchRow) => void;
};

export function ReceivingBatchesTable({
  batches,
  isLoading,
  onViewBatch,
  canTransferBatch = true,
  onTransferBatch,
}: ReceivingBatchesTableProps) {
  if (isLoading) {
    return <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">Loading receiving history…</div>;
  }

  if (batches.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">
        No receiving batches created yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[#eef2f5]">
        <thead className="bg-white">
          <tr>
            <HeaderCell>Batch</HeaderCell>
            <HeaderCell>Source</HeaderCell>
            <HeaderCell>Warehouse</HeaderCell>
            <HeaderCell className="text-right">Units</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell>Created</HeaderCell>
            <HeaderCell className="text-right">Action</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef2f5] bg-[#fbfcfc]">
          {batches.map((batch) => (
            <tr
              key={batch.id}
              onClick={() => onViewBatch(batch)}
              className="cursor-pointer transition hover:bg-[#f3f7fa]"
            >
              <td className="px-4 py-3">
                <div className="max-w-[220px]">
                  <p className="truncate text-sm font-semibold text-[#12384b]">{batch.code}</p>
                  <p className="mt-1 text-[12px] text-[#7b8e9c]">{batch.store.name}</p>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="max-w-[220px]">
                  <p className="truncate text-sm text-[#12384b]">
                    {batch.sourceRequestId || batch.requestTitle || 'Manual'}
                  </p>
                  <p className="mt-1 text-[12px] text-[#7b8e9c]">
                    {batch.stagingLocation ? `${batch.stagingLocation.code} · ${batch.stagingLocation.name}` : 'No staging'}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-[#12384b]">
                {batch.warehouse.code} · {batch.warehouse.name}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#12384b]">
                {batch.unitCount}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${getReceivingStatusClassName(batch.status)}`}
                >
                  {formatReceivingStatusLabel(batch.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-[#4d6677]">{formatShortDate(batch.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {onTransferBatch && canTransferBatch && batch.status !== 'COMPLETED' && batch.labelPrintCount > 0 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTransferBatch(batch);
                      }}
                      className="inline-flex items-center rounded-full bg-[#12384b] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0f3242]"
                    >
                      Transfer
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewBatch(batch);
                    }}
                    className="inline-flex items-center rounded-full border border-[#d7e0e7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
                  >
                    Labels
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
