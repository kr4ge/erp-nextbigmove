"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

interface DashboardSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DashboardSection({
  title,
  icon,
  children,
  meta,
  className,
  contentClassName,
}: DashboardSectionProps) {
  return (
    <section
      className={clsx(
        "overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h4>
        {typeof meta === "string" ? (
          <span className="ml-auto min-w-0 text-[10px] text-slate-500">
            {meta}
          </span>
        ) : meta ? (
          <div className="ml-auto min-w-0">{meta}</div>
        ) : null}
      </div>
      <div className={clsx("p-3", contentClassName)}>{children}</div>
    </section>
  );
}
