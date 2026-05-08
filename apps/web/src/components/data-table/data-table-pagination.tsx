"use client";

import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  totalRows?: number;
  showPageSizeSelector?: boolean;
  showFirstLastButtons?: boolean;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  totalRows,
  showPageSizeSelector = true,
  showFirstLastButtons = true,
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const paginationState = table.getState().pagination;
  const pageIndex = paginationState.pageIndex;
  const pageSize = paginationState.pageSize;
  const resolvedTotalRows = totalRows ?? table.getFilteredRowModel().rows.length;
  const from = resolvedTotalRows > 0 ? pageIndex * pageSize + 1 : 0;
  const to =
    resolvedTotalRows > 0
      ? Math.min((pageIndex + 1) * pageSize, resolvedTotalRows)
      : 0;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 text-sm text-[#475569] sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
      {...props}
    >
      <div className="text-center sm:text-left">
        Showing {from}-{to} of {resolvedTotalRows}
      </div>
      <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
        {showPageSizeSelector ? (
          <select
            value={pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="hidden rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:block lg:w-auto"
          >
            {pageSizeOptions.map((pageSizeOption) => (
              <option key={pageSizeOption} value={pageSizeOption}>
                {pageSizeOption} per page
              </option>
            ))}
          </select>
        ) : null}

        <div className="flex items-center gap-2">
          {showFirstLastButtons ? (
            <Button
              className="hidden lg:inline-flex"
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              First
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="px-2 py-1 text-xs text-[#0F172A] sm:px-3 sm:py-1.5 sm:text-sm">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
          {showFirstLastButtons ? (
            <Button
              className="hidden lg:inline-flex"
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              Last
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
