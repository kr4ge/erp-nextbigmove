'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type AnalyticsTableSelectorOption<T extends string> = {
  key: T;
  label: string;
};

type AnalyticsTableSelectorProps<T extends string> = {
  options: AnalyticsTableSelectorOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
  fallbackLabel: string;
  className?: string;
};

export function AnalyticsTableSelector<T extends string>({
  options,
  selectedKey,
  onSelect,
  fallbackLabel,
  className,
}: AnalyticsTableSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(
    () => options.find((item) => item.key === selectedKey)?.label || fallbackLabel,
    [fallbackLabel, options, selectedKey],
  );

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!containerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div className={className} ref={containerRef}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 sm:text-lg"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="whitespace-nowrap">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`block w-full text-left px-3 py-2 text-sm sm:text-base ${
                selectedKey === opt.key ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
              }`}
              onClick={() => {
                onSelect(opt.key);
                setOpen(false);
              }}
            >
              <span className="whitespace-nowrap">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
