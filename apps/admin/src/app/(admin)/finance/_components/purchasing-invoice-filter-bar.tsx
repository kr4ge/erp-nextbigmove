'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type {
  WmsInvoiceOverviewResponse,
  WmsInvoiceSourceType,
  WmsInvoiceStatus,
} from '../_types/purchasing';

type PurchasingInvoiceFilterBarProps = {
  filters: WmsInvoiceOverviewResponse['filters'] | null | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedSourceType?: WmsInvoiceSourceType;
  onSourceTypeChange: (value: WmsInvoiceSourceType | undefined) => void;
  selectedStatus?: WmsInvoiceStatus;
  onStatusChange: (value: WmsInvoiceStatus | undefined) => void;
};

export function PurchasingInvoiceFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedSourceType,
  onSourceTypeChange,
  selectedStatus,
  onStatusChange,
}: PurchasingInvoiceFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-[1_1_20rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search invoice number, source code, notes, or line item"
          className="input grow pr-10 pl-10 text-sm-custom"
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

      <WmsScopeFilterFields
        tenantOptions={(filters?.tenants ?? []).map((tenant) => ({
          value: tenant.id,
          label: tenant.label,
        }))}
        selectedTenantId={selectedTenantId}
        onTenantChange={onTenantChange}
      />

      <WmsSearchableSelect
        label="Source"
        value={selectedSourceType ?? ''}
        onChange={(value) => onSourceTypeChange((value as WmsInvoiceSourceType) || undefined)}
        options={(filters?.sourceTypes ?? []).map((sourceType) => ({
          value: sourceType.value,
          label: sourceType.label,
          hint: sourceType.invoiceCount,
        }))}
        placeholder="Search invoice sources..."
        allLabel="All sources"
        hideInlineLabel={true}
      />

      <WmsSearchableSelect
        label="Status"
        value={selectedStatus ?? ''}
        onChange={(value) => onStatusChange((value as WmsInvoiceStatus) || undefined)}
        options={(filters?.statuses ?? []).map((status) => ({
          value: status.value,
          label: status.label,
          hint: status.invoiceCount,
        }))}
        placeholder="Search invoice statuses..."
        allLabel="All statuses"
        hideInlineLabel={true}
      />
    </div>
  );
}
