"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableTooltipCellProps extends React.ComponentProps<"span"> {
  value: React.ReactNode;
  tooltip?: string;
  truncate?: boolean;
}

export function DataTableTooltipCell({
  value,
  tooltip,
  truncate = true,
  className,
  ...props
}: DataTableTooltipCellProps) {
  const content =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const titleValue = tooltip ?? content;

  return (
    <span
      className={cn("inline-block max-w-full", truncate && "truncate", className)}
      title={titleValue || undefined}
      {...props}
    >
      {value}
    </span>
  );
}

