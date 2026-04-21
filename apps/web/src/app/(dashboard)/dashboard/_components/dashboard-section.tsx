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
        "panel panel-content", // "panel panel-content"
        className,
      )}
    >
      <div
        className={clsx(
          "panel-header", // "panel-header"
          headerClassName,
        )}
      >
        {icon}
        <h4
          className={clsx(
            "panel-title",
            // "text-xs font-semibold uppercase tracking-[0.18em] text-slate-700",
            titleClassName,
          )}
        >
          {title}
        </h4>
        {typeof meta === "string" ? (
          <span className="ml-auto hidden min-w-0 text-xs-tight text-slate-500 sm:inline">
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
