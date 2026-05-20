'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type {
  WmsPurchasingBatchStatus,
  WmsPurchasingOverviewResponse,
  WmsPurchasingRequestType,
} from '../_types/purchasing';

type PurchasingFilterBarProps = {
  filters: WmsPurchasingOverviewResponse['filters'] | null | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  selectedRequestType?: WmsPurchasingRequestType;
  onRequestTypeChange: (value: WmsPurchasingRequestType | undefined) => void;
  selectedStatus?: WmsPurchasingBatchStatus;
  onStatusChange: (value: WmsPurchasingBatchStatus | undefined) => void;
};

export function PurchasingFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedStoreId,
  onStoreChange,
  selectedRequestType,
  onRequestTypeChange,
  selectedStatus,
  onStatusChange,
}: PurchasingFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-[1_1_20rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search request ID, title, invoice, or item"
          className="input pr-10 pl-10 text-sm-custom grow"
        />
        {searchText ? (
          <button
            type="button"
            onClick={() => onSearchTextChange('')}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8193a0] transition hover:bg-[#eef2f5] hover:text-[#12384b]"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <WmsScopeFilterFields
        tenantOptions={(filters?.tenants ?? []).map((tenant) => ({
          value: tenant.id,
          label: tenant.label,
        }))}
        selectedTenantId={selectedTenantId}
        onTenantChange={onTenantChange}
        storeOptions={(filters?.stores ?? []).map((store) => ({
          value: store.id,
          label: store.label,
          hint: store.batchCount,
        }))}
        selectedStoreId={selectedStoreId}
        onStoreChange={onStoreChange}
      />

      <WmsSearchableSelect
        label="Type"
        value={selectedRequestType ?? ''}
        onChange={(value) => onRequestTypeChange((value as WmsPurchasingRequestType) || undefined)}
        options={(filters?.requestTypes ?? []).map((requestType) => ({
          value: requestType.value,
          label: requestType.label,
          hint: requestType.batchCount,
        }))}
        placeholder="Search request types..."
        allLabel="All request types"
        hideInlineLabel={true}
      />

      <WmsSearchableSelect
        label="Status"
        value={selectedStatus ?? ''}
        onChange={(value) => onStatusChange((value as WmsPurchasingBatchStatus) || undefined)}
        options={(filters?.statuses ?? []).map((status) => ({
          value: status.value,
          label: status.label,
          hint: status.batchCount,
        }))}
        placeholder="Search statuses..."
        hideInlineLabel={true}
        allLabel="All statuses"
      />
    </div>
  );
}
