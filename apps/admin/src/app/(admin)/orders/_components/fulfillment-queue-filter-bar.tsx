'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';

type FulfillmentQueueFilterBarProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  tenantOptions: WmsSearchableOption[];
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  storeOptions: WmsSearchableOption[];
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  statusOptions: Array<{
    value: string;
    label: string;
  }>;
};

export function FulfillmentQueueFilterBar({
  searchText,
  onSearchTextChange,
  tenantOptions,
  selectedTenantId,
  onTenantChange,
  storeOptions,
  selectedStoreId,
  onStoreChange,
  selectedStatus,
  onStatusChange,
  statusOptions,
}: FulfillmentQueueFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2.5">
      <div className="relative min-w-[260px] flex-[1_1_24rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by order ID, shop, or customer"
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
      <div className="grid min-w-[480px] flex-[0_0_30rem] grid-cols-2 gap-2.5 [&>*]:min-w-0 [&_button]:w-full">
        <WmsScopeFilterFields
          tenantOptions={tenantOptions}
          selectedTenantId={selectedTenantId}
          onTenantChange={onTenantChange}
          storeOptions={storeOptions}
          selectedStoreId={selectedStoreId}
          onStoreChange={onStoreChange}
        />
      </div>
      <select
        value={selectedStatus}
        onChange={(event) => onStatusChange(event.target.value)}
        className="h-12 w-[180px] shrink-0 rounded-2xl border border-[#d7e0e7] bg-white px-3.5 text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3] focus:shadow-[0_0_0_4px_rgba(18,56,75,0.08)]"
      >
        {statusOptions.map((option) => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
