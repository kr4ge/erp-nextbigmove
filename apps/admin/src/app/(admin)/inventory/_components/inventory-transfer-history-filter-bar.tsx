'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import type { WmsInventoryTransfersResponse } from '../_types/inventory';

type InventoryTransferHistoryFilterBarProps = {
  filters: WmsInventoryTransfersResponse['filters'] | null | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedWarehouseId?: string;
  onWarehouseChange: (value: string | undefined) => void;
};

export function InventoryTransferHistoryFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedWarehouseId,
  onWarehouseChange,
}: InventoryTransferHistoryFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="wms-pill-control flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 text-[#12384b]">
        <Search className="h-4 w-4 text-[#8193a0]" />
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by transfer, location, notes, or unit code"
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
        warehouseOptions={(filters?.warehouses ?? []).map((warehouse) => ({
          value: warehouse.id,
          label: warehouse.label,
          hint: warehouse.transferCount,
        }))}
        selectedWarehouseId={selectedWarehouseId}
        onWarehouseChange={onWarehouseChange}
      />
    </div>
  );
}
