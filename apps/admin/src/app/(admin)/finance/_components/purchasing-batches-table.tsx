'use client';

import { Eye, FileSearch } from 'lucide-react';
import type { WmsPurchasingBatchRow } from '../_types/purchasing';
import {
  formatRequestTypeLabel,
  formatShortDate,
  formatStatusLabel,
  getStatusClasses,
} from '../_utils/purchasing-presenters';

type PurchasingBatchesTableProps = {
  batches: WmsPurchasingBatchRow[];
  isLoading: boolean;
  tenantReady: boolean;
  onOpenBatch: (batchId: string) => void;
};

export function PurchasingBatchesTable({
  batches,
  isLoading,
  tenantReady,
  onOpenBatch,
}: PurchasingBatchesTableProps) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#eef2f5]">
          <thead className="bg-[#eff3f6]">
            <tr>
              <TableHeader className="min-w-[260px]">Request</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Store</TableHeader>
              <TableHeader className="text-right">Qty</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Updated</TableHeader>
              <TableHeader className="text-right">Action</TableHeader>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#eef2f5]">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <tr key={`loading-${rowIndex}`}>
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <td key={`loading-${rowIndex}-${cellIndex}`} className="px-4 py-3.5">
                      <div className="h-3.5 animate-pulse rounded-full bg-[#eef2f5]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !tenantReady ? (
              <StateRow
                title="Tenant context required"
                message="Open a tenant context first before reviewing purchasing batches."
              />
            ) : batches.length === 0 ? (
              <StateRow
                title="No purchasing batches found"
                message="No requests match the current filters."
              />
            ) : (
              batches.map((batch) => (
                <tr key={batch.id} className="group transition hover:bg-[#fbfcfc]">
                  <td className="px-4 py-3">
                    <div className="max-w-[260px] space-y-0.5">
                      <p className="truncate text-sm font-semibold text-[#12384b]">
                        {batch.sourceRequestId || batch.requestTitle || batch.id.slice(0, 8)}
                      </p>
                      <p className="truncate text-[12px] text-[#7b8e9c]">
                        {batch.requestTitle || batch.sourceStatus || 'No request title'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-2 py-0.5 text-[10.5px] font-semibold text-[#4d6677]">
                      {formatRequestTypeLabel(batch.requestType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#12384b]">
                    <span className="block max-w-[180px] truncate">{batch.store.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-[#12384b]">
                    {batch.approvedQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${getStatusClasses(batch.status)}`}
                    >
                      {formatStatusLabel(batch.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#4d6677]">
                    {formatShortDate(batch.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenBatch(batch.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e0e7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#12384b] transition hover:border-[#12384b] hover:bg-[#12384b] hover:text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHeader({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b8e9c] ${className}`}
    >
      {children}
    </th>
  );
}

function StateRow({ title, message }: { title: string; message: string }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-16">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dce4ea] bg-[#fbfcfc] text-[#5e8196]">
            <FileSearch className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-[#12384b]">{title}</p>
          <p className="text-[12.5px] text-[#7b8e9c]">{message}</p>
        </div>
      </td>
    </tr>
  );
}

