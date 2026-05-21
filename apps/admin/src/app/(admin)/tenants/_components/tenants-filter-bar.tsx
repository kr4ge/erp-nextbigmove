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

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-[1_1_20rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by organization name or slug"
          className="input pr-10 pl-10 text-sm-custom grow"
        />
        {searchText ? (
          <button
            type="button"
            onClick={() => onSearchTextChange('')}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8193a0] transition hover:bg-[#eef2f5] hover:text-primary"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <WmsSearchableSelect
        label="Plan"
        value={planFilter}
        onChange={(value) => onPlanChange(value as TenantPlan | '')}
        options={planOptions.map((option) => ({ value: option.value, label: option.label }))}
        placeholder="Filter by plan…"
        allLabel="All plans"
        hideInlineLabel={true}
      />

      <div className="flex items-center flex-none rounded-2xl border border-[#d7e0e7] bg-[#fbfcfc] p-1 sm:gap-1">
        {statusChips.map((chip) => {
          const isActive = statusFilter === chip.value;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onStatusChange(chip.value)}
              className={`rounded-xl px-3.5 py-1.5 text-sm-custom font-semibold transition ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-primary'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
