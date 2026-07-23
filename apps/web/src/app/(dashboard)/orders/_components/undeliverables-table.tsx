'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { AnalyticsTableEmptyRow } from '../../analytics/_components/analytics-table-shell';
import type { UndeliverableRemarkOption, UndeliverableRow } from '../_types/undeliverables';

function formatLifecycleDuration(totalSeconds: number) {
  const absoluteSeconds = Math.max(0, Math.abs(totalSeconds));
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.ceil((absoluteSeconds % 3600) / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(1, minutes)}m`;
}

function getLifecyclePresentation(row: UndeliverableRow, nowMs: number) {
  if (row.latest_remark) {
    if (row.remarked_late || row.lifecycle_status === 'REMARKED_LATE') {
      return {
        label: `Remarked late by ${row.latest_remark.author_name}`,
        className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
      };
    }

    return {
      label: `Remarked by ${row.latest_remark.author_name}`,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    };
  }

  const deadlineMs = new Date(row.deadline_at).getTime();
  const remainingSeconds = Number.isFinite(deadlineMs)
    ? Math.ceil((deadlineMs - nowMs) / 1000)
    : (row.remaining_seconds ?? 0);

  if (remainingSeconds <= 0 || (!Number.isFinite(deadlineMs) && row.lifecycle_status === 'UNATTENDED')) {
    return {
      label: `Unattended · ${formatLifecycleDuration(remainingSeconds)} overdue`,
      className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    };
  }

  return {
    label: `Awaiting remark · ${formatLifecycleDuration(remainingSeconds)} left`,
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  };
}

type UndeliverablesTableProps = {
  rows: UndeliverableRow[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isLoading?: boolean;
  serverTime?: string | null;
  canViewAll: boolean;
  canWriteRemarks: boolean;
  failedAtOrder: 'asc' | 'desc';
  remarkOptions: UndeliverableRemarkOption[];
  onSaveRemark: (row: UndeliverableRow, remarkOptionId: string) => Promise<void>;
  onOpenTracking: (row: UndeliverableRow) => void;
  onToggleFailedAtOrder: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function UndeliverablesTable({
  rows,
  page,
  totalPages,
  total,
  limit,
  isLoading = false,
  serverTime = null,
  canViewAll,
  canWriteRemarks,
  failedAtOrder,
  remarkOptions,
  onSaveRemark,
  onOpenTracking,
  onToggleFailedAtOrder,
  onPrevious,
  onNext,
}: UndeliverablesTableProps) {
  const formatCodAmount = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      return '-';
    }

    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatFailedAt = (row: UndeliverableRow) => {
    if (!row.failed_at) {
      return row.date_local || '-';
    }

    const parsed = new Date(row.failed_at);
    if (Number.isNaN(parsed.getTime())) {
      return row.date_local || '-';
    }

    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(parsed);
  };

  const getStatusBadgeClass = (statusName: string | null) => {
    const normalized = statusName?.trim().toLowerCase();
    if (normalized === 'shipped') {
      return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300';
    }
    if (normalized === 'returning') {
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300';
    }
    if (normalized === 'returned') {
      return 'border-red-300 bg-red-100 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300';
    }
    if (normalized === 'delivered') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300';
    }
    return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-border dark:bg-background-secondary dark:text-slate-300';
  };

  const start = total === 0 ? 0 : ((page - 1) * limit) + 1;
  const end = total === 0 ? 0 : Math.min(total, page * limit);
  const [openRemarkRowId, setOpenRemarkRowId] = useState<string | null>(null);
  const [savingRemarkRowId, setSavingRemarkRowId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const parsedServerTime = serverTime ? new Date(serverTime).getTime() : Number.NaN;
    const serverOffsetMs = Number.isFinite(parsedServerTime) ? parsedServerTime - Date.now() : 0;
    const syncClock = () => setNowMs(Date.now() + serverOffsetMs);
    syncClock();
    const intervalId = window.setInterval(syncClock, 60_000);
    return () => window.clearInterval(intervalId);
  }, [serverTime]);

  const handleSaveRemark = async (row: UndeliverableRow, remarkOptionId: string) => {
    if (!remarkOptionId) {
      return;
    }

    setSavingRemarkRowId(row.id);
    try {
      await onSaveRemark(row, remarkOptionId);
      setOpenRemarkRowId(null);
    } finally {
      setSavingRemarkRowId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-slate-100 dark:divide-border">
          <thead className="bg-slate-50 dark:bg-background-secondary">
            <tr>
              <th className="w-16 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:bg-background-secondary dark:text-slate-300">
                #
              </th>
              {canViewAll ? (
                <th className="min-w-[12rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                  SA Assigned
                </th>
              ) : null}
              <th className="min-w-[18rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                SA Remarks
              </th>
              <th className="min-w-[15rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                SA Response
              </th>
              <th className="min-w-[11rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                <button
                  type="button"
                  onClick={onToggleFailedAtOrder}
                  className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold uppercase text-slate-500 transition hover:text-slate-800 focus:outline-none dark:text-slate-300 dark:hover:text-slate-100"
                  aria-label={`Sort failed at ${failedAtOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  Failed At
                  {failedAtOrder === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </th>
              <th className="min-w-[9rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Status
              </th>
              <th className="min-w-[10rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Waybill Number
              </th>
              <th className="min-w-[10rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Phone Number
              </th>
              <th className="min-w-[9rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Cod Amount
              </th>
              <th className="min-w-[8rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Attempt Failed
              </th>
              <th className="min-w-[12rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Store
              </th>
              <th className="min-w-[8rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Order ID
              </th>
              <th className="min-w-[12rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Address
              </th>
              <th className="min-w-[10rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Barangay
              </th>
              <th className="min-w-[10rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                City
              </th>
              <th className="min-w-[10rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Province
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-border dark:bg-surface">
            {rows.length === 0 ? (
              <AnalyticsTableEmptyRow
                colSpan={canViewAll ? 16 : 15}
                message="No undeliverable attempts found for the selected filters."
              />
            ) : null}
            {rows.map((row, index) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onOpenTracking(row)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenTracking(row);
                  }
                }}
                className="cursor-pointer align-top bg-white transition-colors hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange-400 dark:bg-surface dark:hover:bg-background-secondary"
              >
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {((page - 1) * limit) + index + 1}.
                </td>
                {canViewAll ? (
                  <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                    {row.sa_assigned.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {row.sa_assigned.map((assignee) => (
                          <span key={assignee.user_id} className="whitespace-nowrap">
                            {assignee.full_name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                  </td>
                ) : null}
                <td
                  className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="space-y-2">
                    {canWriteRemarks ? (
                      openRemarkRowId === row.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(event) => {
                              void handleSaveRemark(row, event.target.value);
                            }}
                            className="h-9 min-w-[13rem] rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 dark:border-border dark:bg-background-secondary dark:text-slate-200"
                          >
                            <option value="" disabled>
                              Select SA remark
                            </option>
                            {remarkOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.remark}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:text-slate-300 dark:hover:text-slate-100"
                            onClick={() => setOpenRemarkRowId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpenRemarkRowId(row.id)}
                          className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 hover:border-slate-300 dark:border-border dark:bg-background-secondary dark:text-slate-300"
                        >
                          <span className={`truncate ${row.latest_remark ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                            {savingRemarkRowId === row.id
                              ? 'Saving...'
                              : row.latest_remark?.remark ?? 'No remarks yet'}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </button>
                      )
                    ) : row.latest_remark ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-600 dark:border-border dark:bg-background-secondary dark:text-slate-300">
                        <p className="line-clamp-2">{row.latest_remark.remark}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">No remarks yet</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {(() => {
                    const lifecycle = getLifecyclePresentation(row, nowMs);
                    return (
                      <span
                        className={`inline-flex max-w-[15rem] rounded-full border px-2.5 py-1 font-semibold ${lifecycle.className}`}
                      >
                        <span className="truncate">{lifecycle.label}</span>
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap dark:text-slate-300">
                  {formatFailedAt(row)}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-foreground">
                  {row.status_name ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${getStatusBadgeClass(row.status_name)}`}
                    >
                      {row.status_name}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.tracking || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.customer_phone || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {formatCodAmount(row.cod_amount)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.attempt_number ?? row.attempt_failed}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.store_name}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-foreground">
                  #{row.pos_order_id}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.address || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.barangay || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.city || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.province || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-border dark:bg-background-secondary sm:flex-row sm:px-4">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Showing {start}-{end} of {total}
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-background-secondary"
            onClick={onPrevious}
            disabled={page <= 1 || isLoading}
          >
            Previous
          </button>
          <span className="inline-flex min-w-[96px] items-center justify-center px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <button
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-background-secondary"
            onClick={onNext}
            disabled={page >= totalPages || isLoading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
