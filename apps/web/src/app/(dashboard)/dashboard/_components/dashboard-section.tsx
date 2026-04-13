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
  headerClassName?: string;
  titleClassName?: string;
}

export function DashboardSection({
  title,
  icon,
  children,
  meta,
  className,
  contentClassName,
  headerClassName,
  titleClassName,
}: DashboardSectionProps) {
  return (
    <section
      className={clsx(
        "overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div
        className={clsx(
          "flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2",
          headerClassName,
        )}
      >
        {icon}
        <h4
          className={clsx(
            "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700",
            titleClassName,
          )}
        >
          {title}
        </h4>
        {typeof meta === "string" ? (
          <span className="ml-auto hidden min-w-0 text-[10px] text-slate-500 sm:inline">
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
