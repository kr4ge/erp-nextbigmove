'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

type AnalyticsSortToggleLabelProps = {
  label: string;
  isActive: boolean;
  direction: 'asc' | 'desc';
  onToggle: () => void;
};

export function AnalyticsSortToggleLabel({
  label,
  isActive,
  direction,
  onToggle,
}: AnalyticsSortToggleLabelProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-slate-500 hover:text-slate-700"
    >
      <span>{label}</span>
      {isActive ? (
        direction === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
}
