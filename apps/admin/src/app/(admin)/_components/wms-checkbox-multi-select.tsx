'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type WmsCheckboxMultiSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type WmsCheckboxMultiSelectProps = {
  label: string;
  allLabel: string;
  options: WmsCheckboxMultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function WmsCheckboxMultiSelect({
  label,
  allLabel,
  options,
  selectedValues,
  onChange,
  placeholder = 'Search…',
  disabled = false,
}: WmsCheckboxMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedLabel = useMemo(() => {
    if (selectedValues.length === 0) return allLabel;
    if (selectedValues.length === 1) {
      return options.find((option) => option.value === selectedValues[0])?.label ?? `1 ${label}`;
    }
    return `${selectedValues.length} ${label.toLowerCase()}s`;
  }, [allLabel, label, options, selectedValues]);
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => (
      option.label.toLowerCase().includes(needle)
      || option.hint?.toLowerCase().includes(needle)
    ));
  }, [options, query]);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gutter = 12;
      const width = Math.min(Math.max(320, rect.width), window.innerWidth - gutter * 2);
      setPopoverStyle({
        top: rect.bottom + 6,
        left: Math.min(Math.max(gutter, rect.left), window.innerWidth - width - gutter),
        width,
        maxHeight: Math.max(200, window.innerHeight - rect.bottom - gutter - 62),
      });
    };
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const frame = requestAnimationFrame(() => {
      updatePosition();
      inputRef.current?.focus();
    });

    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(
      selectedSet.has(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value],
    );
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`wms-pill-control flex min-w-[190px] items-center justify-between gap-2 rounded-2xl border bg-white pl-3.5 pr-2.5 text-primary transition disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-[#96b4c3] shadow-[0_0_0_4px_rgba(18,56,75,0.08)]' : 'border-[#d7e0e7] hover:border-[#c6d4dd]'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 text-left">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">
            {label}
          </span>
          <span className="block max-w-[190px] truncate text-[12.5px] font-semibold text-primary">
            {selectedLabel}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#8193a0] transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && portalReady
        ? createPortal(
            <div
              ref={popoverRef}
              role="listbox"
              aria-multiselectable="true"
              className="fixed z-[120] overflow-hidden rounded-[20px] border border-[#dce4ea] bg-white shadow-[0_24px_60px_-28px_rgba(18,56,75,0.35)]"
              style={{
                top: popoverStyle?.top ?? -9999,
                left: popoverStyle?.left ?? -9999,
                width: popoverStyle?.width ?? 320,
                visibility: popoverStyle ? 'visible' : 'hidden',
              }}
            >
              <div className="flex items-center gap-2 border-b border-[#eef2f5] px-3.5 py-2.5">
                <Search className="h-4 w-4 text-[#8193a0]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={placeholder}
                  className="h-7 min-w-0 flex-1 border-none bg-transparent text-[13px] text-primary outline-none placeholder:text-[#94a3b8]"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-[#8193a0]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center justify-between border-b border-[#eef2f5] px-3.5 py-2">
                <span className="text-[11px] font-medium text-[#8193a0]">{options.length} available</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(options.map((option) => option.value))}
                    className="rounded-xl px-2 py-1 text-[11px] font-semibold text-primary hover:bg-[#eef2f5]"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="rounded-xl px-2 py-1 text-[11px] font-semibold text-[#6f8290] hover:bg-[#eef2f5]"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto py-1.5" style={{ maxHeight: popoverStyle?.maxHeight ?? 320 }}>
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12.5px] text-[#8193a0]">No matches found</div>
                ) : filteredOptions.map((option) => {
                  const selected = selectedSet.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggle(option.value)}
                      className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] transition ${
                        selected ? 'bg-[#eef6f8]' : 'hover:bg-[#f1f5f7]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-primary">{option.label}</span>
                        {option.hint ? <span className="block truncate text-[11px] text-[#6f8290]">{option.hint}</span> : null}
                      </span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected ? 'border-primary bg-primary text-white' : 'border-[#cbd8e1] bg-white text-transparent'
                      }`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
