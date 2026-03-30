'use client';

import type { ReactNode } from 'react';

type AnalyticsTableShellProps = {
  children: ReactNode;
  summaryLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  isLoading?: boolean;
};

type AnalyticsTableLoadingRowsProps = {
  rowCount?: number;
  colCount: number;
};

type AnalyticsTableEmptyRowProps = {
  colSpan: number;
  message: string;
};

export function AnalyticsTableLoadingRows({
  rowCount = 5,
  colCount,
}: AnalyticsTableLoadingRowsProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={`analytics-table-loading-${rowIndex}`}>
          {Array.from({ length: colCount }).map((__, cellIndex) => (
            <td key={`analytics-table-loading-${rowIndex}-${cellIndex}`} className="px-3 py-3 sm:px-4 lg:px-6">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AnalyticsTableEmptyRow({ colSpan, message }: AnalyticsTableEmptyRowProps) {
  return (
    <tr>
      <td className="px-3 py-4 text-center text-slate-500 sm:px-4 lg:px-6" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

export function AnalyticsTableShell({
  children,
  summaryLabel,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  isLoading = false,
}: AnalyticsTableShellProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {children}
      <div className="flex flex-shrink-0 flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:px-6">
        <p className="text-sm text-slate-600">{summaryLabel}</p>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onPrevious}
            disabled={!canPrevious || isLoading}
          >
            Previous
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onNext}
            disabled={!canNext || isLoading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
