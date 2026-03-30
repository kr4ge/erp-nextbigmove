"use client";

import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  label: string;
  className?: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  label,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={className}>{label}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-2 transition hover:text-[#0F172A]",
        className,
      )}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {column.getIsSorted() === "desc" ? (
        <ChevronDown className="h-4 w-4" />
      ) : column.getIsSorted() === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  );
}
