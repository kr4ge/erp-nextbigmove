'use client';

import { usePathname } from 'next/navigation';
import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type WmsSearchableOption = {
  value: string;
  label: string;
  hint?: string | number;
};

type WmsSearchableSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: WmsSearchableOption[];
  placeholder?: string;
  /** Label shown when value is empty */
  allLabel?: string;
  /** Allow clearing back to empty value */
  clearable?: boolean;
  /** Minimum pixel width of the popover */
  popoverMinWidth?: number;
};

export function WmsSearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  allLabel = 'All',
  clearable = true,
  popoverMinWidth = 260,
}: WmsSearchableSelectProps) {
  const pathname = usePathname();
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
    setOpen(false);
    setQuery('');
    setPopoverStyle(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target)
        && !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

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
      const preferredWidth = Math.max(popoverMinWidth, rect.width);
      const width = Math.min(preferredWidth, viewportWidth - gutter * 2);
      const left = Math.min(Math.max(gutter, rect.left), viewportWidth - width - gutter);

      const popoverHeight = popover.offsetHeight || 320;
      const spaceBelow = viewportHeight - rect.bottom - gutter;
      const spaceAbove = rect.top - gutter;
      const shouldOpenUp = spaceBelow < Math.min(280, popoverHeight) && spaceAbove > spaceBelow;

      const maxHeight = Math.max(
        180,
        Math.floor((shouldOpenUp ? spaceAbove : spaceBelow) - 8),
      );

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

    const raf = requestAnimationFrame(() => {
      updatePopoverPosition();
      inputRef.current?.focus();
    });

    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      cancelAnimationFrame(raf);
    };
  }, [open, popoverMinWidth]);

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
        onClick={() => setOpen((prev) => !prev)}
        className={`wms-pill-control flex items-center gap-2 rounded-full border bg-white pl-3.5 pr-2.5 text-[#12384b] transition ${
          open ? 'border-[#96b4c3] shadow-[0_0_0_4px_rgba(18,56,75,0.08)]' : 'border-[#d7e0e7] hover:border-[#c6d4dd]'
        }`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">{label}</span>
        <span className="max-w-[180px] truncate text-[12.5px] font-semibold text-[#12384b]">
          {selected?.label ?? allLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#8193a0] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && portalReady
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[120] overflow-hidden rounded-[20px] border border-[#dce4ea] bg-white shadow-[0_24px_60px_-28px_rgba(18,56,75,0.35)]"
              style={{
                top: popoverStyle?.top ?? -9999,
                left: popoverStyle?.left ?? -9999,
                width: popoverStyle?.width ?? popoverMinWidth,
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
                  className="h-7 w-full border-none bg-transparent text-[13px] text-[#12384b] outline-none placeholder:text-[#94a3b8]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[#8193a0] transition hover:bg-[#eef2f5] hover:text-[#12384b]"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>

              <div
                className="overflow-y-auto py-1.5"
                style={{ maxHeight: popoverStyle?.maxHeight ?? 260 }}
              >
                {clearable ? (
                  <OptionRow
                    label={allLabel}
                    active={value === ''}
                    onClick={() => handleSelect('')}
                  />
                ) : null}

                {filtered.length === 0 ? (
                  <div className="px-3.5 py-6 text-center text-[12.5px] text-[#8193a0]">
                    No matches found
                  </div>
                ) : (
                  filtered.map((option) => (
                    <OptionRow
                      key={option.value}
                      label={option.label}
                      hint={option.hint}
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
  hint,
  active,
  onClick,
}: {
  label: string;
  hint?: string | number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] transition ${
        active
          ? 'bg-[#12384b] text-white'
          : 'text-[#12384b] hover:bg-[#f1f5f7]'
      }`}
    >
      <span className="truncate font-semibold">{label}</span>
      {hint !== undefined ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
            active ? 'bg-white/15 text-white' : 'bg-[#f1f5f7] text-[#4d6677]'
          }`}
        >
          {typeof hint === 'number' ? hint.toLocaleString() : hint}
        </span>
      ) : null}
    </button>
  );
}
