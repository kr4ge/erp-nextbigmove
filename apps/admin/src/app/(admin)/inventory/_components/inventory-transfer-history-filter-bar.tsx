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
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-[1_1_20rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by transfer, location, notes, or unit code"
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
