'use client';

import { type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type SortDirection = 'asc' | 'desc';

type AnalyticsSortDirectionLabelProps = {
  label: ReactNode;
  activeDirection: SortDirection | null;
  onSort: (direction: SortDirection) => void;
  ariaLabel: string;
};

const buttonClass = (active: boolean) =>
  `h-3 w-3 ${active ? 'text-slate-700' : 'text-slate-400'} hover:text-slate-600`;

export function AnalyticsSortDirectionLabel({
  label,
  activeDirection,
  onSort,
  ariaLabel,
}: AnalyticsSortDirectionLabelProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="inline-flex flex-col -space-y-1 leading-none">
        <button
          type="button"
          aria-label={`Sort ${ariaLabel} high to low`}
          onClick={() => onSort('desc')}
          className="leading-none"
        >
          <ChevronUp className={buttonClass(activeDirection === 'desc')} />
        </button>
        <button
          type="button"
          aria-label={`Sort ${ariaLabel} low to high`}
          onClick={() => onSort('asc')}
          className="leading-none"
        >
          <ChevronDown className={buttonClass(activeDirection === 'asc')} />
        </button>
      </span>
    </span>
  );
}
