"use client";

import { WmsTablePagination } from "../../_components/wms-table-pagination";

type InventoryProductsPaginationProps = {
  pageIndex: number;
  pageSize: number;
  pageSizeOptions?: number[];
  totalItems: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function InventoryProductsPagination({
  pageIndex,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  totalItems,
  onPageIndexChange,
  onPageSizeChange,
}: InventoryProductsPaginationProps) {
  return (
    <WmsTablePagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      totalItems={totalItems}
      onPageIndexChange={onPageIndexChange}
      onPageSizeChange={onPageSizeChange}
    />
  );
}
