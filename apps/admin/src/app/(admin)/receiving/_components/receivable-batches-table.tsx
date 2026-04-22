'use client';

import type { WmsReceivablePurchasingBatch } from '../_types/receiving';
import { formatShortDate } from '../_utils/receiving-presenters';

type ReceivableBatchesTableProps = {
  batches: WmsReceivablePurchasingBatch[];
  isLoading: boolean;
  canReceive: boolean;
  onReceive: (batch: WmsReceivablePurchasingBatch) => void;
};

export function ReceivableBatchesTable({
  batches,
  isLoading,
  canReceive,
  onReceive,
}: ReceivableBatchesTableProps) {
  if (isLoading) {
    return <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">Loading receiving queue…</div>;
  }

  if (batches.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-[#7b8e9c]">
        No purchasing batches are waiting for receiving.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[#eef2f5]">
        <thead className="bg-white">
          <tr>
            <HeaderCell>Request</HeaderCell>
            <HeaderCell>Store</HeaderCell>
            <HeaderCell className="text-right">Lines</HeaderCell>
            <HeaderCell className="text-right">Remaining</HeaderCell>
            <HeaderCell>Ready</HeaderCell>
            <HeaderCell className="text-right">Action</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eef2f5] bg-[#fbfcfc]">
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td className="px-4 py-3">
                <div className="max-w-[300px]">
                  <p className="truncate text-sm font-semibold text-[#12384b]">
                    {batch.sourceRequestId || batch.requestTitle || batch.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-[12px] text-[#7b8e9c]">
                    {batch.requestType.replace('_', ' ')} · {batch.status.replaceAll('_', ' ').toLowerCase()}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-[#12384b]">{batch.store.name}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#12384b]">
                {batch.lineCount}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#12384b]">
                {batch.remainingQuantity}
              </td>
              <td className="px-4 py-3 text-sm text-[#4d6677]">{formatShortDate(batch.readyForReceivingAt)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onReceive(batch)}
                  disabled={!canReceive}
                  className="inline-flex items-center rounded-full bg-[#12384b] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Receive
                </button>
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
