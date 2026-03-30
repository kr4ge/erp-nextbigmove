"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableActionCellProps extends React.ComponentProps<"div"> {
  align?: "left" | "center" | "right";
}

export function DataTableActionCell({
  align = "right",
  className,
  children,
  ...props
}: DataTableActionCellProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        align === "left"
          ? "justify-start"
          : align === "center"
            ? "justify-center"
            : "justify-end",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

