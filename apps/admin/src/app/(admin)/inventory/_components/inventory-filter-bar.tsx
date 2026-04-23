'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type { WmsInventoryOverviewResponse, WmsInventoryUnitStatus } from '../_types/inventory';

type InventoryFilterBarProps = {
  filters: WmsInventoryOverviewResponse['filters'] | null | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  selectedWarehouseId?: string;
  onWarehouseChange: (value: string | undefined) => void;
  selectedStatus?: WmsInventoryUnitStatus;
  onStatusChange: (value: WmsInventoryUnitStatus | undefined) => void;
};

export function InventoryFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedStoreId,
  onStoreChange,
  selectedWarehouseId,
  onWarehouseChange,
  selectedStatus,
  onStatusChange,
}: InventoryFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="wms-pill-control flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 text-[#12384b]">
        <Search className="h-4 w-4 text-[#8193a0]" />
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by unit, barcode, product, or variation"
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
          hint: store.unitCount,
        }))}
        selectedStoreId={selectedStoreId}
        onStoreChange={onStoreChange}
        warehouseOptions={(filters?.warehouses ?? []).map((warehouse) => ({
          value: warehouse.id,
          label: warehouse.label,
          hint: warehouse.unitCount,
        }))}
        selectedWarehouseId={selectedWarehouseId}
        onWarehouseChange={onWarehouseChange}
      />

      <WmsSearchableSelect
        label="Status"
        value={selectedStatus ?? ''}
        onChange={(value) => onStatusChange((value as WmsInventoryUnitStatus) || undefined)}
        options={(filters?.statuses ?? []).map((status) => ({
          value: status.value,
          label: status.label,
          hint: status.unitCount,
        }))}
        placeholder="Search statuses…"
        allLabel="All statuses"
      />
    </div>
  );
}
