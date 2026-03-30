"use client";

import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableStateProps extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function DataTableState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: DataTableStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-8 text-center", className)}
      {...props}
    >
      {icon ? <div className="mb-3 text-[#94A3B8]">{icon}</div> : null}
      <p className="text-sm font-semibold text-[#334155]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[#64748B]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function DataTableLoadingState({
  title = "Loading table data",
  description = "Please wait while we fetch the latest records.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <DataTableState
      className={className}
      title={title}
      description={description}
      icon={<Loader2 className="h-5 w-5 animate-spin" />}
    />
  );
}

export function DataTableEmptyState({
  title = "No results found",
  description = "Try adjusting filters or search terms.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <DataTableState
      className={className}
      title={title}
      description={description}
      icon={<Inbox className="h-5 w-5" />}
    />
  );
}

export function DataTableErrorState({
  title = "Unable to load table data",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <DataTableState
      className={className}
      title={title}
      description={description}
      icon={<AlertCircle className="h-5 w-5 text-rose-500" />}
    />
  );
}

