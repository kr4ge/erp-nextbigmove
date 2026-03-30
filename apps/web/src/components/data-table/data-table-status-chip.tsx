"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

export type DataTableStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

const toneClassMap: Record<DataTableStatusTone, string> = {
  neutral: "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

interface DataTableStatusChipProps extends React.ComponentProps<"span"> {
  label: React.ReactNode;
  tone?: DataTableStatusTone;
  dot?: boolean;
}

export function DataTableStatusChip({
  label,
  tone = "neutral",
  dot = false,
  className,
  ...props
}: DataTableStatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClassMap[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {label}
    </span>
  );
}

