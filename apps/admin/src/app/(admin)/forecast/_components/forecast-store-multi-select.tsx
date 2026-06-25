'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WmsForecastStoreOption } from '../_types/forecast';

type ForecastStoreMultiSelectProps = {
  stores: WmsForecastStoreOption[];
  selectedStoreIds: string[];
  onToggleStore: (storeId: string) => void;
  onClearStores: () => void;
};

export function ForecastStoreMultiSelect({
  stores,
  selectedStoreIds,
  onToggleStore,
  onClearStores,
}: ForecastStoreMultiSelectProps) {
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

  const selectedCount = selectedStoreIds.length;
  const selectedLabel = selectedCount === 0
    ? 'Select stores'
    : selectedCount === 1
      ? stores.find((store) => store.id === selectedStoreIds[0])?.name ?? '1 store'
      : `${selectedCount} stores`;

  const filteredStores = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return stores;
    }

    return stores.filter((store) => (
      store.name.toLowerCase().includes(needle)
      || store.tenantName.toLowerCase().includes(needle)
      || store.shopId.toLowerCase().includes(needle)
    ));
  }, [query, stores]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

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
      const width = Math.min(Math.max(320, rect.width), viewportWidth - gutter * 2);
      const left = Math.min(Math.max(gutter, rect.left), viewportWidth - width - gutter);
      const maxHeight = Math.max(220, viewportHeight - rect.bottom - gutter - 8);

      setPopoverStyle({
        top: rect.bottom + 6,
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`wms-pill-control flex items-center justify-between gap-2 rounded-2xl border bg-white pl-3.5 pr-2.5 text-primary transition ${
          open ? 'border-[#96b4c3] shadow-[0_0_0_4px_rgba(18,56,75,0.08)]' : 'border-[#d7e0e7] hover:border-[#c6d4dd]'
        }`}
      >
        <span className="max-w-[180px] truncate text-[12.5px] font-semibold text-primary">
          {selectedLabel}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#8193a0] transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && portalReady
        ? createPortal(
            <div
              ref={popoverRef}
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
                  placeholder="Search stores..."
                  className="h-7 w-full border-none bg-transparent text-[13px] text-primary outline-none placeholder:text-[#94a3b8]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="flex h-5 w-5 items-center justify-center rounded-2xl text-[#8193a0] transition hover:bg-[#eef2f5] hover:text-primary"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
                {selectedStoreIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={onClearStores}
                    className="shrink-0 rounded-xl px-2 py-1 text-[11px] font-semibold text-[#6f8290] transition hover:bg-[#eef2f5] hover:text-primary"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div
                className="overflow-y-auto py-1.5"
                style={{ maxHeight: popoverStyle?.maxHeight ?? 320 }}
              >
                {filteredStores.length === 0 ? (
                  <div className="px-3.5 py-6 text-center text-[12.5px] text-[#8193a0]">
                    No stores found
                  </div>
                ) : (
                  filteredStores.map((store) => {
                    const selected = selectedStoreIds.includes(store.id);

                    return (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => onToggleStore(store.id)}
                        className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] transition ${
                          selected ? 'bg-[#eef6f8] text-primary' : 'text-primary hover:bg-[#f1f5f7]'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{store.name}</span>
                          <span className="block truncate text-[11px] text-[#6f8290]">
                            {store.tenantName} · {store.shopId}
                          </span>
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            selected
                              ? 'border-[#12384b] bg-[#12384b] text-white'
                              : 'border-[#cbd8e1] bg-white text-transparent'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
