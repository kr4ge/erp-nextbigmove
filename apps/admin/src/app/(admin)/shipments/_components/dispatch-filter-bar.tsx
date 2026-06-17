'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';

type DispatchFilterBarProps = {
  showSearch?: boolean;
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
  showStatus?: boolean;
};

export function DispatchFilterBar({
  showSearch = true,
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
  showStatus = true,
}: DispatchFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-2.5">
      {showSearch ? (
        <div className="relative min-w-[260px] flex-[1_1_24rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Search order, store, customer, or waybill"
            className="input grow pr-10 pl-10 text-sm-custom"
          />
          {searchText ? (
            <button
              type="button"
              onClick={() => onSearchTextChange('')}
              className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8193a0] transition hover:bg-[#eef2f5] hover:text-primary"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={`grid min-w-[480px] ${showSearch ? 'flex-[0_0_30rem]' : 'flex-[1_1_auto]'} grid-cols-2 gap-2.5 [&>*]:min-w-0 [&_button]:w-full`}>
        <WmsScopeFilterFields
          tenantOptions={tenantOptions}
          selectedTenantId={selectedTenantId}
          onTenantChange={onTenantChange}
          storeOptions={storeOptions}
          selectedStoreId={selectedStoreId}
          onStoreChange={onStoreChange}
          allowAllTenants={true}
        />
      </div>

      {showStatus ? (
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
      ) : null}
    </div>
  );
}
