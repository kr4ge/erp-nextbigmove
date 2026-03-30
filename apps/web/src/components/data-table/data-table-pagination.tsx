"use client";

import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTablePaginationProps<TData> extends React.ComponentProps<"div"> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  totalRows?: number;
  showPageSizeSelector?: boolean;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50],
  totalRows,
  showPageSizeSelector = true,
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
        "flex items-center justify-between text-sm text-[#475569]",
        className,
      )}
      {...props}
    >
      <div>
        Showing {from}-{to} of {resolvedTotalRows}
      </div>
      <div className="flex items-center gap-2">
        {showPageSizeSelector ? (
          <select
            value={pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((pageSizeOption) => (
              <option key={pageSizeOption} value={pageSizeOption}>
                {pageSizeOption} per page
              </option>
            ))}
          </select>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <span className="px-3 py-1.5 text-sm text-[#0F172A]">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}
