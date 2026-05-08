"use client";

import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import type * as React from "react";
import {
  getCommonPinningStyles,
  getDataTableRowVariantClassName,
  getPinnedCellClassName,
  getRowHoverClassName,
  type DataTableRowVariant,
} from "@/lib/data-table";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  loading?: boolean;
  loadingRowCount?: number;
  loadingState?: React.ReactNode;
  error?: React.ReactNode;
  errorState?: React.ReactNode;
  emptyState?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  showPagination?: boolean;
  pageSizeOptions?: number[];
  totalRows?: number;
  showPageSizeSelector?: boolean;
  showFirstLastButtons?: boolean;
  stickyHeader?: boolean;
  bodyMaxHeight?: number | string;
  getRowClassName?: (row: Row<TData>) => string | undefined;
  getRowVariant?: (row: Row<TData>) => DataTableRowVariant | null | undefined;
  onRowClick?: (row: Row<TData>) => void;
}

export function DataTable<TData>({
  table,
  actionBar,
  loading = false,
  loadingRowCount = 6,
  loadingState,
  error,
  errorState,
  emptyState,
  emptyTitle = "No results found",
  emptyDescription = "Try adjusting your filters or search terms.",
  showPagination = true,
  pageSizeOptions,
  totalRows,
  showPageSizeSelector = true,
  showFirstLastButtons = true,
  stickyHeader = false,
  bodyMaxHeight,
  getRowClassName,
  getRowVariant,
  onRowClick,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  const colSpan =
    table.getVisibleLeafColumns().length || table.getAllLeafColumns().length || 1;
  const hasRows = table.getRowModel().rows.length > 0;
  const hasError = Boolean(error);
  const stickyHeadEnabled = stickyHeader && Boolean(bodyMaxHeight);
  const bodyStyle: React.CSSProperties | undefined = bodyMaxHeight
    ? {
        maxHeight:
          typeof bodyMaxHeight === "number"
            ? `${bodyMaxHeight}px`
            : bodyMaxHeight,
      }
    : undefined;

  const renderDefaultState = (
    title: string,
    description: string,
    extraClassName?: string,
  ) => (
    <div className={cn("py-8 text-center", extraClassName)}>
      <p className="text-sm font-semibold text-[#334155]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[#64748B]">{description}</p> : null}
    </div>
  );

  const renderStateRow = (content: React.ReactNode) => (
    <tr>
      <td colSpan={colSpan} className="px-6 py-4 align-middle text-[#475569]">
        {content}
      </td>
    </tr>
  );

  const renderLoadingRows = () => (
    <>
      {Array.from({ length: Math.max(1, loadingRowCount) }).map((_, rowIdx) => (
        <tr key={`loading-row-${rowIdx}`}>
          {Array.from({ length: colSpan }).map((__, cellIdx) => (
            <td key={`loading-cell-${rowIdx}-${cellIdx}`} className="px-6 py-4 align-middle">
              <div className="h-4 w-full animate-pulse rounded bg-[#E2E8F0]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );

  const getAlignClassName = (align?: "left" | "center" | "right") => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      {children}
      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className={cn("overflow-x-auto", bodyMaxHeight && "overflow-y-auto")} style={bodyStyle}>
          <table className="min-w-full divide-y divide-[#E2E8F0]">
            <thead className={cn("bg-[#F8FAFC]", stickyHeadEnabled && "sticky top-0 z-20")}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "px-6 py-3 text-xs font-semibold text-[#475569] uppercase tracking-wide",
                        getPinnedCellClassName({
                          column: header.column,
                          section: "head",
                        }),
                        getAlignClassName(header.column.columnDef.meta?.align),
                        header.column.columnDef.meta?.headerClassName,
                      )}
                      style={{
                        ...getCommonPinningStyles({ column: header.column }),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                loadingState ? (
                  renderStateRow(loadingState)
                ) : (
                  renderLoadingRows()
                )
              ) : hasError ? (
                renderStateRow(
                  errorState ??
                    renderDefaultState("Unable to load table data", String(error ?? "")),
                )
              ) : hasRows ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      getRowHoverClassName(Boolean(onRowClick)),
                      getDataTableRowVariantClassName(getRowVariant?.(row)),
                      getRowClassName?.(row),
                    )}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    role={onRowClick ? "button" : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-6 py-4 text-sm text-[#0F172A] align-middle",
                          getPinnedCellClassName({
                            column: cell.column,
                            section: "body",
                          }),
                          getAlignClassName(cell.column.columnDef.meta?.align),
                          cell.column.columnDef.meta?.cellClassName,
                          cell.column.columnDef.meta?.truncate && "max-w-0 truncate",
                        )}
                        style={{
                          ...getCommonPinningStyles({ column: cell.column }),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : emptyState ? (
                renderStateRow(emptyState)
              ) : (
                renderStateRow(renderDefaultState(emptyTitle, emptyDescription))
              )}
            </tbody>
          </table>
        </div>
        {showPagination ? (
          <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3">
            <DataTablePagination
              table={table}
              pageSizeOptions={pageSizeOptions}
              totalRows={totalRows}
              showPageSizeSelector={showPageSizeSelector}
              showFirstLastButtons={showFirstLastButtons}
            />
          </div>
        ) : null}
      </div>
      {actionBar &&
        table.getFilteredSelectedRowModel().rows.length > 0 &&
        actionBar}
    </div>
  );
}
