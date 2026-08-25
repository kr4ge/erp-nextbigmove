"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function RegistryPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: Props) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3">
      <p className="text-sm text-muted">
        Showing {firstItem}–{lastItem} of {total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex items-center rounded-full border border-border bg-background-secondary px-3.5 text-xs font-semibold text-foreground">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
