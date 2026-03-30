'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AnalyticsMultiSelectOption = {
  value: string;
  label: string;
};

type AnalyticsMultiSelectPickerProps = {
  selectedLabel: string;
  selectTitle: string;
  options: AnalyticsMultiSelectOption[];
  allChecked: boolean;
  isChecked: (value: string) => boolean;
  onToggleAll: (checked: boolean) => void;
  onToggle: (value: string) => void;
  onOnly: (value: string) => void;
  onClear: () => void;
  className?: string;
};

export function AnalyticsMultiSelectPicker({
  selectedLabel,
  selectTitle,
  options,
  allChecked,
  isChecked,
  onToggleAll,
  onToggle,
  onOnly,
  onClear,
  className,
}: AnalyticsMultiSelectPickerProps) {
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
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none"
      >
        <span className="text-slate-900">{selectedLabel}</span>
        <span className="text-slate-400 text-xs">(click to choose)</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 border-b border-slate-100">
            <span>{selectTitle}</span>
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(true);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Clear
            </button>
          </div>
          <div className="px-3 py-2 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type to search"
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) => {
                    onToggleAll(event.target.checked);
                    setOpen(true);
                  }}
                  className="rounded border-slate-300"
                />
                <span>All</span>
              </label>
            </div>
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked(option.value)}
                    onChange={() => {
                      onToggle(option.value);
                      setOpen(true);
                    }}
                    className="rounded border-slate-300"
                  />
                  <span>{option.label}</span>
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  onClick={() => {
                    onOnly(option.value);
                    setOpen(true);
                  }}
                >
                  ONLY
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
