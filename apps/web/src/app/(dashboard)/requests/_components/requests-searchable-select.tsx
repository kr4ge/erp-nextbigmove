'use client';

import { ChevronDown, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

type RequestsSearchableOption = {
  value: string;
  label: string;
};

type RequestsSearchableSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: RequestsSearchableOption[];
  allLabel: string;
  placeholder?: string;
};

export function RequestsSearchableSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  placeholder = 'Search…',
}: RequestsSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = () => {
      setOpen(false);
      setQuery('');
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target)
        && !popoverRef.current?.contains(target)
      ) {
        close();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gutter = 12;
      const preferredWidth = Math.max(260, rect.width);
      const width = Math.min(preferredWidth, viewportWidth - gutter * 2);
      const left = Math.min(Math.max(gutter, rect.left), viewportWidth - width - gutter);

      const popoverHeight = popover.offsetHeight || 320;
      const spaceBelow = viewportHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const shouldOpenUp = spaceBelow < Math.min(280, popoverHeight) && spaceAbove > spaceBelow;

      const maxHeight = Math.max(180, Math.floor((shouldOpenUp ? spaceAbove : spaceBelow) - 8));
      const top = shouldOpenUp
        ? Math.max(gutter, rect.top - Math.min(popoverHeight, maxHeight) - 6)
        : Math.min(viewportHeight - gutter, rect.bottom + 6);

      setPopoverStyle({
        top,
        left,
        width,
        maxHeight,
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    const raf = requestAnimationFrame(() => {
      updatePopoverPosition();
      inputRef.current?.focus();
    });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={`flex h-8 w-full items-center gap-2 rounded-lg border bg-white pl-3 pr-2 text-slate-800 transition ${
          open
            ? 'border-slate-300 shadow-[0_0_0_3px_rgba(148,163,184,0.18)]'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="text-[8px] font-semibold uppercase tracking-[0.17em] text-slate-500">
          {label}
        </span>
        <span className="max-w-[160px] truncate text-[11.5px] font-semibold text-slate-800">
          {selected?.label ?? allLabel}
        </span>
        <ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && portalReady
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_42px_-28px_rgba(15,23,42,0.35)]"
              style={{
                top: popoverStyle?.top ?? -9999,
                left: popoverStyle?.left ?? -9999,
                width: popoverStyle?.width ?? 260,
                visibility: popoverStyle ? 'visible' : 'hidden',
              }}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={placeholder}
                  className="h-6 w-full border-none bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>

              <div className="overflow-y-auto py-1" style={{ maxHeight: popoverStyle?.maxHeight ?? 260 }}>
                <OptionRow
                  label={allLabel}
                  active={value === ''}
                  onClick={() => handleSelect('')}
                />

                {filtered.length === 0 ? (
                  <div className="px-3 py-5 text-center text-xs text-slate-500">
                    No matches found
                  </div>
                ) : (
                  filtered.map((option) => (
                    <OptionRow
                      key={option.value}
                      label={option.label}
                      active={option.value === value}
                      onClick={() => handleSelect(option.value)}
                    />
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function OptionRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-[12px] transition ${
        active
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="truncate font-semibold">{label}</span>
    </button>
  );
}
