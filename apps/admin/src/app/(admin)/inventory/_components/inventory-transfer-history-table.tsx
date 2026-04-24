'use client';

import type { ReactNode } from 'react';
import type { WmsInventoryTransferRecord } from '../_types/inventory';

type InventoryTransferHistoryTableProps = {
  transfers: WmsInventoryTransferRecord[];
  isLoading: boolean;
  tenantReady: boolean;
};

export function InventoryTransferHistoryTable({
  transfers,
  isLoading,
  tenantReady,
}: InventoryTransferHistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-[#eaf0f4] text-left">
            <HeaderCell>Transfer</HeaderCell>
            <HeaderCell>Warehouse</HeaderCell>
            <HeaderCell>Route</HeaderCell>
            <HeaderCell>Units</HeaderCell>
            <HeaderCell>Actor</HeaderCell>
            <HeaderCell>Updated</HeaderCell>
            <HeaderCell>Status</HeaderCell>
          </tr>
        </thead>

        <tbody className="bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                Loading transfers…
              </td>
            </tr>
          ) : !tenantReady ? (
            <tr>
              <td colSpan={7} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                No tenant scope is active for transfer history.
              </td>
            </tr>
          ) : transfers.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                No inventory transfers match the current scope.
              </td>
            </tr>
          ) : (
            transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b border-[#edf2f6] text-[13px] text-[#12384b]">
                <BodyCell className="font-semibold text-[#12384b]">
                  <div className="min-w-0">
                    <div className="truncate">{transfer.code}</div>
                    <div className="mt-1 truncate text-[11px] font-medium text-[#7c8f9b]">
                      {transfer.notes || 'Internal transfer'}
                    </div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#12384b]">{transfer.warehouse.name}</div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">{transfer.warehouse.code}</div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-[200px]">
                    <div className="truncate font-medium text-[#12384b]">
                      {transfer.fromLocation?.code ?? 'No source'} → {transfer.toLocation.code}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">
                      {transfer.fromLocation?.name ?? 'No source'} → {transfer.toLocation.name}
                    </div>
                  </div>
                </BodyCell>

                <BodyCell>{transfer.itemCount}</BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#12384b]">{transfer.actor?.name ?? 'System'}</div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">{transfer.actor?.email ?? '—'}</div>
                  </div>
                </BodyCell>

                <BodyCell>{formatDateTime(transfer.createdAt)}</BodyCell>

                <BodyCell>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    transfer.status === 'COMPLETED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}>
                    {transfer.status === 'COMPLETED' ? 'Completed' : 'Canceled'}
                  </span>
                </BodyCell>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8193a0] ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={`px-5 py-3.5 align-middle ${align === 'right' ? 'text-right' : 'text-left'} ${className}`.trim()}>
      {children}
    </td>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
