'use client';

import { Search, X } from 'lucide-react';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type { TenantPlan, TenantStatus } from '../_types/tenant';

const statusChips: Array<{ value: '' | TenantStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const planOptions: Array<{ value: TenantPlan; label: string }> = [
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

type TenantsFilterBarProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  statusFilter: TenantStatus | '';
  onStatusChange: (value: TenantStatus | '') => void;
  planFilter: TenantPlan | '';
  onPlanChange: (value: TenantPlan | '') => void;
};

export function TenantsFilterBar({
  searchText,
  onSearchTextChange,
  statusFilter,
  onStatusChange,
  planFilter,
  onPlanChange,
}: TenantsFilterBarProps) {
  const hasActiveFilters = Boolean(searchText || statusFilter || planFilter);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="wms-pill-control flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 text-[#12384b]">
        <Search className="h-4 w-4 text-[#8193a0]" />
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by organization name or slug"
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

      <WmsSearchableSelect
        label="Plan"
        value={planFilter}
        onChange={(value) => onPlanChange(value as TenantPlan | '')}
        options={planOptions.map((option) => ({ value: option.value, label: option.label }))}
        placeholder="Filter by plan…"
        allLabel="All plans"
      />

      <div className="flex items-center gap-1 rounded-full border border-[#d7e0e7] bg-[#fbfcfc] p-1">
        {statusChips.map((chip) => {
          const isActive = statusFilter === chip.value;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onStatusChange(chip.value)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                isActive
                  ? 'bg-[#12384b] text-white shadow-[0_10px_24px_-18px_rgba(18,56,75,0.7)]'
                  : 'text-[#4d6677] hover:text-[#12384b]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => {
            onSearchTextChange('');
            onStatusChange('');
            onPlanChange('');
          }}
          className="wms-pill-control inline-flex items-center gap-1.5 rounded-full border border-[#d7e0e7] bg-white px-3.5 text-[12px] font-semibold text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b]"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
