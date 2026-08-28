'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import clsx from 'clsx';

export type SearchableSelectOption = { value: string; label: string };

type Props = {
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  /** Panel title, e.g. "Select stores". */
  selectTitle?: string;
  searchPlaceholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * Offer a "+ Add …" row for a search term that matches nothing. The typed
   * text is passed to onCreate, which decides the stored value; the component
   * never invents a value itself.
   */
  allowCustom?: boolean;
  /** Noun for the add row: "+ Add hook type". */
  customLabel?: string;
  onCreate?: (label: string) => void;
  className?: string;
};

/**
 * Single-select with search, in the same visual language as the analytics
 * multi-select picker: trigger with a "(click to choose)" hint, a panel with a
 * title and Clear, a search box, then rows. No checkboxes — one value.
 *
 * Meant to replace native <select>s wherever a list is long enough to search
 * or open-ended enough to need a custom entry.
 */
export function SearchableSelect({
  name, label, value, onChange, options, placeholder = 'Choose',
  selectTitle, searchPlaceholder = 'Search', helper, error, required,
  disabled, allowCustom, customLabel = 'option', onCreate, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    // Focus the search so the panel is usable from the keyboard immediately.
    searchRef.current?.focus();
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const selected = options.find((option) => option.value === value) ?? null;
  const keyword = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (keyword ? options.filter((o) => o.label.toLowerCase().includes(keyword)) : options),
    [options, keyword],
  );
  // The add row appears only for text that is not already an option, so it
  // never duplicates something the user could just click.
  const canCreate = Boolean(allowCustom && onCreate && keyword)
    && !options.some((o) => o.label.toLowerCase() === keyword);

  const choose = (next: string) => {
    onChange(next);
    setSearch('');
    setOpen(false);
  };

  return (
    <div className={clsx('space-y-1.5', className)} ref={containerRef}>
      {label ? (
        <label className="form-label" htmlFor={name}>
          {label}{required ? <span className="ml-0.5 text-primary">*</span> : null}
        </label>
      ) : null}

      <div className="relative">
        <button
          id={name}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={clsx(
            'input flex w-full items-center justify-between gap-2 text-left',
            error ? 'border-destructive bg-destructive-soft/50' : 'bg-surface',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className={clsx('truncate', selected ? 'text-foreground' : 'text-muted')}>
              {selected ? selected.label : placeholder}
            </span>
            {selected && !disabled ? <span className="shrink-0 text-xs text-faint">(click to choose)</span> : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        </button>

        {open && !disabled ? (
          <div
            role="listbox"
            className="absolute left-0 z-30 mt-2 w-full min-w-[18rem] rounded-xl border border-border bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm text-foreground">
              <span>{selectTitle ?? (label ? `Select ${label.toLowerCase()}` : 'Select')}</span>
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => { onChange(''); setSearch(''); }}
              >
                Clear
              </button>
            </div>
            <div className="border-b border-border/60 px-3 py-2">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false);
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (filtered.length === 1) choose(filtered[0].value);
                    else if (canCreate) { onCreate!(search.trim()); setSearch(''); setOpen(false); }
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-auto py-1">
              {filtered.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(option.value)}
                    className={clsx(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/30',
                      active ? 'font-semibold text-primary' : 'text-foreground',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
              {filtered.length === 0 && !canCreate ? (
                <p className="px-3 py-2 text-sm text-muted">No matches</p>
              ) : null}
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => { onCreate!(search.trim()); setSearch(''); setOpen(false); }}
                  className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-secondary/30"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">Add {customLabel} &ldquo;{search.trim()}&rdquo;</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {(helper || error) ? (
        <p className={clsx('text-xs', error ? 'text-destructive' : 'text-muted')}>{error || helper}</p>
      ) : null}
    </div>
  );
}
