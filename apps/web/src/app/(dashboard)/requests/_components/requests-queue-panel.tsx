'use client';

import clsx from 'clsx';
import { ListChecks, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  WmsPurchasingBatchRow,
  WmsPurchasingBatchStatus,
  WmsPurchasingRequestType,
} from '../_types/request';
import {
  formatRequestTypeLabel,
  formatShortDate,
  formatStatusLabel,
  getStatusClasses,
} from '../_utils/request-presenters';

interface RequestsQueuePanelProps {
  rows: WmsPurchasingBatchRow[];
  stores: Array<{ id: string; label: string }>;
  requestTypes: Array<{ value: WmsPurchasingRequestType; label: string }>;
  statuses: Array<{ value: WmsPurchasingBatchStatus; label: string }>;
  selectedStoreId: string;
  selectedRequestType: WmsPurchasingRequestType | '';
  selectedStatus: WmsPurchasingBatchStatus | '';
  search: string;
  page: number;
  totalPages: number;
  total: number;
  selectedBatchId: string | null;
  onStoreChange: (value: string) => void;
  onRequestTypeChange: (value: WmsPurchasingRequestType | '') => void;
  onStatusChange: (value: WmsPurchasingBatchStatus | '') => void;
  onSearchChange: (value: string) => void;
  onPageChange: (nextPage: number) => void;
  onSelectBatch: (id: string) => void;
}

export function RequestsQueuePanel({
  rows,
  stores,
  requestTypes,
  statuses,
  selectedStoreId,
  selectedRequestType,
  selectedStatus,
  search,
  page,
  totalPages,
  total,
  selectedBatchId,
  onStoreChange,
  onRequestTypeChange,
  onStatusChange,
  onSearchChange,
  onPageChange,
  onSelectBatch,
}: RequestsQueuePanelProps) {
  return (
    <section className="panel panel-content">
      <div className="panel-header">
        <ListChecks className="h-3.5 w-3.5 text-orange-500" />
        <h4 className="panel-title">Request Queue</h4>
        <span className="ml-auto text-xs text-slate-500">{total} total</span>
      </div>

      <div className="space-y-4 p-3">
        <div className="grid gap-3 lg:grid-cols-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8ba1]" />
            <input
              className="h-10 w-full rounded-xl border border-[#dce4ea] bg-white pl-9 pr-3 text-sm text-[#12344d] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbe9ff]"
              placeholder="Search request, product or store"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </label>

          <select
            className="h-10 rounded-xl border border-[#dce4ea] px-3 text-sm text-[#12344d] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbe9ff]"
            value={selectedStoreId}
            onChange={(event) => onStoreChange(event.target.value)}
          >
            <option value="">All stores</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.label}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-[#dce4ea] px-3 text-sm text-[#12344d] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbe9ff]"
            value={selectedRequestType}
            onChange={(event) => onRequestTypeChange(event.target.value as WmsPurchasingRequestType | '')}
          >
            <option value="">All request types</option>
            {requestTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-xl border border-[#dce4ea] px-3 text-sm text-[#12344d] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbe9ff]"
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value as WmsPurchasingBatchStatus | '')}
          >
            <option value="">All statuses</option>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#dce4ea]">
          <table className="min-w-full divide-y divide-[#e6edf5] text-sm">
            <thead className="bg-[#f8fbff] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#73859a]">
              <tr>
                <th className="px-3 py-2">Request</th>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7] bg-white text-[#12344d]">
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-[#7b8ba1]" colSpan={6}>
                    No requests found for the current filters.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={clsx(
                    'cursor-pointer transition hover:bg-[#f5f9ff]',
                    selectedBatchId === row.id ? 'bg-[#eef5ff]' : '',
                  )}
                  onClick={() => onSelectBatch(row.id)}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{row.sourceRequestId ?? row.id.slice(0, 8)}</div>
                    <div className="text-xs text-[#7b8ba1]">{row.requestTitle ?? 'Untitled request'}</div>
                  </td>
                  <td className="px-3 py-2.5">{row.store.name}</td>
                  <td className="px-3 py-2.5">{formatRequestTypeLabel(row.requestType)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.requestedQuantity}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={clsx(
                        'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                        getStatusClasses(row.status),
                      )}
                    >
                      {formatStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[#66788a]">{formatShortDate(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[#7b8ba1]">
            Page {page} of {Math.max(1, totalPages)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

