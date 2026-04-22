'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

type WmsActionBarProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  className?: string;
};

export function WmsActionBar({
  searchText,
  onSearchTextChange,
  searchPlaceholder = 'Search records',
  children,
  className = '',
}: WmsActionBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`.trim()}>
      <label className="wms-pill-control flex min-w-[300px] flex-1 items-center gap-2 rounded-full border border-[#d7e0e7] bg-[#fbfcfc] px-4 text-[#12384b]">
        <Search className="h-4 w-4 text-[#8193a0]" />
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-full w-full border-none bg-transparent text-[13px] outline-none placeholder:text-[#94a3b8]"
        />
        {searchText ? (
          <button
            type="button"
            onClick={() => onSearchTextChange('')}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[#8193a0] transition hover:bg-[#eef2f5] hover:text-[#12384b]"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </label>

      {children}
    </div>
  );
}
