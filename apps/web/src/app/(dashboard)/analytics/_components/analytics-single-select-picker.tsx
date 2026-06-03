'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AnalyticsSingleSelectOption = {
  value: string;
  label: string;
};

type AnalyticsSingleSelectPickerProps = {
  selectedLabel: string;
  selectTitle: string;
  options: AnalyticsSingleSelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  className?: string;
};

export function AnalyticsSingleSelectPicker({
  selectedLabel,
  selectTitle,
  options,
  selectedValue,
  onSelect,
  className,
}: AnalyticsSingleSelectPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const filteredOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [options, search]);

  return (
    <div className={className} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 focus:outline-none"
      >
        <span className="text-slate-900">{selectedLabel}</span>
        <span className="text-xs text-slate-400">(click to choose)</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
            {selectTitle}
          </div>
          <div className="border-b border-slate-100 px-3 py-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:border-primary focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {filteredOptions.map((option) => {
              const isActive = selectedValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    isActive ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isActive ? 'bg-primary' : 'border border-slate-300 bg-white'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
