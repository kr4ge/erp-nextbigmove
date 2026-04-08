"use client";

import { cn } from "@/lib/utils";

type WmsTablePaginationProps = {
  pageIndex: number;
  pageSize: number;
  pageSizeOptions?: number[];
  totalItems: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function paginationButtonClassName(disabled?: boolean) {
  return cn(
    "inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors",
    disabled
      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:text-orange-700",
  );
}

export function WmsTablePagination({
  pageIndex,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  totalItems,
  onPageIndexChange,
  onPageSizeChange,
}: WmsTablePaginationProps) {
  const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1);
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < pageCount - 1;
  const from = totalItems > 0 ? pageIndex * pageSize + 1 : 0;
  const to =
    totalItems > 0 ? Math.min(totalItems, (pageIndex + 1) * pageSize) : 0;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-slate-600">
        Showing{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {from}-{to}
        </span>{" "}
        of{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {totalItems}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option} / page
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageIndexChange(0)}
            disabled={!canGoPrevious}
            className={paginationButtonClassName(!canGoPrevious)}
          >
            First
          </button>
          <button
            type="button"
            onClick={() => onPageIndexChange(pageIndex - 1)}
            disabled={!canGoPrevious}
            className={paginationButtonClassName(!canGoPrevious)}
          >
            Prev
          </button>
          <span className="min-w-[104px] text-center text-sm font-medium text-slate-700">
            Page{" "}
            <span className="font-semibold tabular-nums text-slate-950">
              {pageIndex + 1}
            </span>{" "}
            of{" "}
            <span className="font-semibold tabular-nums text-slate-950">
              {pageCount}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onPageIndexChange(pageIndex + 1)}
            disabled={!canGoNext}
            className={paginationButtonClassName(!canGoNext)}
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onPageIndexChange(pageCount - 1)}
            disabled={!canGoNext}
            className={paginationButtonClassName(!canGoNext)}
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
