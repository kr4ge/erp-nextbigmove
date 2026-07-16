'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnalyticsTableEmptyRow } from '../../analytics/_components/analytics-table-shell';
import type { UndeliverableRemarkOption, UndeliverableRow } from '../_types/undeliverables';

type UndeliverablesTableProps = {
  rows: UndeliverableRow[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isLoading?: boolean;
  canViewAll: boolean;
  canWriteRemarks: boolean;
  remarkOptions: UndeliverableRemarkOption[];
  onSaveRemark: (row: UndeliverableRow, remarkOptionId: string) => Promise<void>;
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
  canViewAll,
  canWriteRemarks,
  remarkOptions,
  onSaveRemark,
  onPrevious,
  onNext,
}: UndeliverablesTableProps) {
  const start = total === 0 ? 0 : ((page - 1) * limit) + 1;
  const end = total === 0 ? 0 : Math.min(total, page * limit);
  const [openRemarkRowId, setOpenRemarkRowId] = useState<string | null>(null);
  const [savingRemarkRowId, setSavingRemarkRowId] = useState<string | null>(null);

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
              <th className="min-w-[9rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Status
              </th>
              <th className="min-w-[10rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Waybill Number
              </th>
              <th className="min-w-[12rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Store
              </th>
              <th className="min-w-[8rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Order ID
              </th>
              <th className="min-w-[8rem] px-3 py-2 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 dark:text-slate-300">
                Date
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
                colSpan={canViewAll ? 12 : 11}
                message="No undeliverable orders found for the selected filters."
              />
            ) : null}
            {rows.map((row, index) => (
              <tr key={row.id} className="align-top bg-white transition-colors hover:bg-slate-50/80 dark:bg-surface dark:hover:bg-background-secondary">
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
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
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
                        <p className="mt-1 text-[11px] text-slate-400">
                          {row.latest_remark.author_name}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400">No remarks yet</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-foreground">
                  {row.status_name || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.tracking || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.store_name}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-foreground">
                  #{row.pos_order_id}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                  {row.date_local}
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
