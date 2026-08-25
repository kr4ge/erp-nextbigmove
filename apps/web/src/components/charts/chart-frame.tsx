'use client';

import type { ReactNode } from 'react';

/**
 * Fixed-height chart container.
 *
 * ResponsiveContainer measures its PARENT, so the parent must have a resolved
 * height — a percentage height inside an auto-height parent collapses the chart
 * to zero. The empty state keeps the SAME height so the page does not reflow
 * when data arrives, and it renders a centred line rather than an empty axis
 * frame, which reads as a broken chart.
 */
export function ChartFrame({ isEmpty, emptyLabel = 'No data in this range.', height = 'h-64', children }: {
  isEmpty?: boolean;
  emptyLabel?: string;
  /** Tailwind height class; must be a resolved height, not a percentage. */
  height?: string;
  children: ReactNode;
}) {
  if (isEmpty) {
    return (
      <div className={`${height} flex w-full items-center justify-center`}>
        <p className="text-sm text-muted">{emptyLabel}</p>
      </div>
    );
  }
  return <div className={`${height} w-full`}>{children}</div>;
}
