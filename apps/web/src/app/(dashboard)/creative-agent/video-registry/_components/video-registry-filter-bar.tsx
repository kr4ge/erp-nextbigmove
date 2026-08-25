'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Filter, Grid2X2, List, RotateCcw, Search, X } from 'lucide-react';
import type {
  GetVideoRegistryParams,
  VideoRegistryFilterOptions,
  VideoRegistryView,
} from '../_types/video-registry';
import { VideoRegistryDateRangePicker } from './video-registry-date-range-picker';

type Props = {
  params: GetVideoRegistryParams;
  searchText: string;
  filters: VideoRegistryFilterOptions;
  view: VideoRegistryView;
  hasActiveFilters: boolean;
  onParamsChange: (patch: Partial<GetVideoRegistryParams>) => void;
  onSearchTextChange: (value: string) => void;
  onViewChange: (view: VideoRegistryView) => void;
  onReset: () => void;
};

const selectClassName = 'h-10 min-w-0 rounded-xl border border-border bg-surface px-3 text-sm-custom font-semibold text-foreground outline-none transition hover:border-primary/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export function VideoRegistryFilterBar({
  params,
  searchText,
  filters,
  view,
  hasActiveFilters,
  onParamsChange,
  onSearchTextChange,
  onViewChange,
  onReset,
}: Props) {
  const [showMore, setShowMore] = useState(false);
  const moreFiltersRef = useRef<HTMLDivElement>(null);
  const secondaryFilterCount = useMemo(
    () => [params.storeId, params.creatorId, params.accountId].filter(Boolean).length,
    [params.accountId, params.creatorId, params.storeId],
  );

  useEffect(() => {
    if (!showMore) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!moreFiltersRef.current?.contains(event.target as Node)) {
        setShowMore(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMore(false);
    };

    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showMore]);

  return (
    <div className="bg-surface px-3 py-3 sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative min-w-60 flex-[1_1_20rem]">
          <span className="sr-only">Search videos</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Search title, code, creator, or alias"
            className="input h-10 w-full rounded-xl bg-surface pl-9 pr-9 text-sm-custom"
          />
          {searchText ? (
            <button type="button" onClick={() => onSearchTextChange('')} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-background-secondary hover:text-foreground" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

          <VideoRegistryDateRangePicker
            startDate={params.startDate}
            endDate={params.endDate}
            onChange={(range) => onParamsChange(range)}
          />

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              value={params.kind}
              onChange={(event) => onParamsChange({ kind: event.target.value as GetVideoRegistryParams['kind'] })}
              className={`${selectClassName} w-32`}
              aria-label="Filter by creative type"
            >
              <option value="">All types</option>
              <option value="VIDEO">Video</option>
              <option value="STATIC">Static</option>
            </select>
            <select
              value={params.revisionState}
              onChange={(event) => onParamsChange({ revisionState: event.target.value as GetVideoRegistryParams['revisionState'] })}
              className={`${selectClassName} w-40`}
              aria-label="Filter by approval status"
            >
              <option value="">All approvals</option>
              {filters.revisionStates.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select
              value={params.performanceStatus}
              onChange={(event) => onParamsChange({ performanceStatus: event.target.value as GetVideoRegistryParams['performanceStatus'] })}
              className={`${selectClassName} w-44`}
              aria-label="Filter by performance status"
            >
              <option value="">All performance</option>
              {filters.performanceStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div ref={moreFiltersRef} className="relative">
            <button
              type="button"
              onClick={() => setShowMore((current) => !current)}
              aria-expanded={showMore}
              aria-haspopup="menu"
              aria-label="More filters"
              title="More filters"
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl border bg-surface transition focus:outline-none focus:ring-2 focus:ring-primary/20 ${showMore ? 'border-primary/40 text-primary' : 'border-border text-muted hover:border-primary/30 hover:text-foreground'}`}
            >
              <Filter className="h-4 w-4" />
              {secondaryFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs-tight font-bold text-primary-foreground">
                  {secondaryFilterCount}
                </span>
              ) : null}
            </button>

            {showMore ? (
              <div
                role="menu"
                className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">More filters</p>
                    <p className="text-xs text-muted">Narrow the creative library.</p>
                  </div>
                  {secondaryFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onParamsChange({ storeId: '', creatorId: '', accountId: '' })}
                      className="text-xs font-semibold text-primary transition hover:text-primary/80"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <FilterField label="Store">
                    <select value={params.storeId} onChange={(event) => onParamsChange({ storeId: event.target.value })} className={`${selectClassName} w-full`}>
                      <option value="">All stores</option>
                      {filters.stores.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FilterField>
                  <FilterField label="Creator">
                    <select value={params.creatorId} onChange={(event) => onParamsChange({ creatorId: event.target.value })} className={`${selectClassName} w-full`}>
                      <option value="">All creators</option>
                      {filters.creators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FilterField>
                  <FilterField label="Meta account">
                    <select value={params.accountId} onChange={(event) => onParamsChange({ accountId: event.target.value })} className={`${selectClassName} w-full`}>
                      <option value="">All accounts</option>
                      {filters.accounts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FilterField>
                  <FilterField label="Sort">
                    <select
                      value={`${params.sortKey}:${params.sortDirection}`}
                      onChange={(event) => {
                        const [sortKey, sortDirection] = event.target.value.split(':') as [GetVideoRegistryParams['sortKey'], GetVideoRegistryParams['sortDirection']];
                        onParamsChange({ sortKey, sortDirection });
                      }}
                      className={`${selectClassName} w-full`}
                    >
                      <option value="code:desc">Newest code</option>
                      <option value="title:asc">Title A–Z</option>
                      <option value="spend:desc">Spend — highest first</option>
                      <option value="hookRate:desc">Hook rate — highest first</option>
                      <option value="holdRate:desc">Hold rate — highest first</option>
                      <option value="ctr:desc">CTR — highest first</option>
                    </select>
                  </FilterField>
                </div>
              </div>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset filters"
              title="Reset filters"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-background-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : null}

        <div className="ml-auto flex h-10 rounded-xl border border-border bg-background-secondary p-1" role="group" aria-label="Registry view">
          <button
            type="button"
            onClick={() => onViewChange('table')}
            className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${view === 'table' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
            aria-pressed={view === 'table'}
            title="Table view"
          >
            <List className="h-4 w-4" />
            <span className="sr-only">Table view</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange('tiles')}
            className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${view === 'tiles' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
            aria-pressed={view === 'tiles'}
            title="Tile view"
          >
            <Grid2X2 className="h-4 w-4" />
            <span className="sr-only">Tile view</span>
          </button>
        </div>
      </div>
    </div>
  );
}
