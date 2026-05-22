'use client';

import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';

type FulfillmentQueueFilterBarProps = {
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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <WmsScopeFilterFields
          tenantOptions={tenantOptions}
          selectedTenantId={selectedTenantId}
          onTenantChange={onTenantChange}
          storeOptions={storeOptions}
          selectedStoreId={selectedStoreId}
          onStoreChange={onStoreChange}
        />

        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Status</span>
          <select
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-12 rounded-2xl border border-[#d7e0e7] bg-white px-3.5 text-[13px] font-semibold text-[#12384b] outline-none transition focus:border-[#96b4c3] focus:shadow-[0_0_0_4px_rgba(18,56,75,0.08)]"
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
