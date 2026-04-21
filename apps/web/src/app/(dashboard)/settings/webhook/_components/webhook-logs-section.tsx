'use client';

import { Fragment } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { WebhookLogItem, WebhookLogsFilters } from '../_types/webhook';
import {
  formatDuration,
  formatWebhookDateTime,
  toStatusBadgeClass,
} from '../_utils/webhook-formatters';

interface WebhookLogsSectionProps {
  canRead: boolean;
  isLoading: boolean;
  error: string | null;
  items: WebhookLogItem[];
  expandedLogId: string | null;
  onToggleExpanded: (id: string) => void;
  onRefresh: () => void;
  filters: WebhookLogsFilters;
  onFiltersChange: (next: Partial<WebhookLogsFilters>) => void;
  onClearFilters: () => void;
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function WebhookLogsSection({
  canRead,
  isLoading,
  error,
  items,
  expandedLogId,
  onToggleExpanded,
  onRefresh,
  filters,
  onFiltersChange,
  onClearFilters,
  page,
  total,
  totalPages,
  limit,
  onPrevPage,
  onNextPage,
}: WebhookLogsSectionProps) {
  const logsStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const logsEnd = Math.min(page * limit, total);

  return (
    <Card>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Webhook Logs</h2>
            <p className="text-sm text-slate-600">
              Monitor API receive status, processing status, duration, and per-order results.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading || !canRead}
            iconLeft={<RefreshCcw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <select
            className="input"
            value={filters.receiveStatus}
            onChange={(event) => onFiltersChange({ receiveStatus: event.target.value })}
          >
            <option value="">All Receive</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="AUTH_FAILED">AUTH_FAILED</option>
            <option value="DISABLED">DISABLED</option>
            <option value="INVALID_TENANT">INVALID_TENANT</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            className="input"
            value={filters.processStatus}
            onChange={(event) => onFiltersChange({ processStatus: event.target.value })}
          >
            <option value="">All Process</option>
            <option value="QUEUED">QUEUED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="PROCESSED">PROCESSED</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="FAILED">FAILED</option>
            <option value="SKIPPED">SKIPPED</option>
          </select>

          <select
            className="input"
            value={filters.relayStatus}
            onChange={(event) => onFiltersChange({ relayStatus: event.target.value })}
          >
            <option value="">All Relay</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="SKIPPED">SKIPPED</option>
          </select>

          <input
            className="input"
            value={filters.shopId}
            onChange={(event) => onFiltersChange({ shopId: event.target.value })}
            placeholder="Shop ID"
          />

          <input
            className="input"
            value={filters.orderId}
            onChange={(event) => onFiltersChange({ orderId: event.target.value })}
            placeholder="Order ID"
          />

          <input
            className="input"
            value={filters.search}
            onChange={(event) => onFiltersChange({ search: event.target.value })}
            placeholder="Search request/error"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input
            type="date"
            className="input"
            value={filters.startDate}
            onChange={(event) => onFiltersChange({ startDate: event.target.value })}
          />
          <input
            type="date"
            className="input"
            value={filters.endDate}
            onChange={(event) => onFiltersChange({ endDate: event.target.value })}
          />
          <div className="flex items-center justify-end lg:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Received</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Request</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">API</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Process</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Relay</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Orders</th>
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Error / Warning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-slate-500" colSpan={8}>
                    Loading webhook logs...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-slate-500" colSpan={8}>
                    No webhook logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <Fragment key={row.id}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => onToggleExpanded(row.id)}
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                        {formatWebhookDateTime(row.receivedAt)}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-mono text-xs text-slate-900">{row.requestId}</div>
                        <div className="text-slate-500">job: {row.queueJobId || '--'}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${toStatusBadgeClass(row.receiveStatus)}`}>
                          {row.receiveStatus}
                        </span>
                        <div className="mt-1 text-slate-500">{row.receiveHttpStatus ?? '--'}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${toStatusBadgeClass(row.processStatus)}`}>
                          {row.processStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${toStatusBadgeClass(row.relayStatus)}`}>
                          {row.relayStatus || 'SKIPPED'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">
                        <div>receive: {formatDuration(row.receiveDurationMs)}</div>
                        <div>process: {formatDuration(row.processingDurationMs)}</div>
                        <div className="font-semibold text-slate-900">total: {formatDuration(row.totalDurationMs)}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">
                        <div>rows: {row.orderRowsCount}</div>
                        <div>upserted: {row.upsertedCount}</div>
                        <div>warnings: {row.warningCount}</div>
                        <div>reconcile queued: {row.reconcileQueuedCount ?? 0}</div>
                        <div>reconcile skipped: {row.reconcileSkippedCount ?? 0}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <div className="font-semibold text-rose-700">{row.errorCode || '--'}</div>
                        <div className="max-w-[340px] truncate text-slate-500">{row.errorMessage || '--'}</div>
                      </td>
                    </tr>
                    {expandedLogId === row.id ? (
                      <tr key={`${row.id}-expanded`} className="bg-slate-50">
                        <td className="px-3 py-3" colSpan={8}>
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="mb-2 text-xs text-slate-500">
                              payload size: {row.payloadBytes ?? 0} bytes • attempts: {row.attempts}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Shop ID</th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Order ID</th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Result</th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Reason</th>
                                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500">Warning</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {row.orders.length > 0 ? (
                                    row.orders.map((order) => (
                                      <tr key={order.id}>
                                        <td className="px-2 py-2 text-xs text-slate-700">{order.shopId || '--'}</td>
                                        <td className="px-2 py-2 text-xs text-slate-700">{order.orderId || '--'}</td>
                                        <td className="px-2 py-2 text-xs text-slate-700">{order.status ?? '--'}</td>
                                        <td className="px-2 py-2 text-xs text-slate-700">
                                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${toStatusBadgeClass(order.upsertStatus)}`}>
                                            {order.upsertStatus}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2 text-xs text-slate-700">{order.reason || '--'}</td>
                                        <td className="px-2 py-2 text-xs text-slate-500">{order.warning || '--'}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-2 py-3 text-xs text-slate-500" colSpan={6}>
                                        No per-order rows captured.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {logsStart}-{logsEnd} of {total}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={onPrevPage}>
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
