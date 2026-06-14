'use client';

import { Search, X } from 'lucide-react';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';
import type { WmsProductsOverviewResponse } from '../_types/product';

type ProductsFilterBarProps = {
  filters: WmsProductsOverviewResponse['filters'] | null | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  selectedPosWarehouseId?: string;
  onPosWarehouseChange: (value: string | undefined) => void;
};

export function ProductsFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedStoreId,
  onStoreChange,
  selectedPosWarehouseId,
  onPosWarehouseChange,
}: ProductsFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-[1_1_20rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by variation, product, or custom ID"
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
        allowAllTenants
        tenantOptions={(filters?.tenants ?? []).map((tenant) => ({
          value: tenant.id,
          label: tenant.label,
        }))}
        selectedTenantId={selectedTenantId}
        onTenantChange={onTenantChange}
        storeOptions={(filters?.stores ?? []).map((store) => ({
          value: store.id,
          label: store.label,
          selectedLabel: store.name,
          hint: store.productCount,
        }))}
        selectedStoreId={selectedStoreId}
        onStoreChange={onStoreChange}
      />

      <WmsSearchableSelect
        label="POS"
        value={selectedPosWarehouseId ?? ''}
        onChange={(value) => onPosWarehouseChange(value || undefined)}
        options={(filters?.posWarehouses ?? []).map((warehouse) => ({
          value: warehouse.id,
          label: warehouse.label,
          hint: warehouse.productCount,
        }))}
        placeholder="Search POS warehouses…"
        allLabel="All POS warehouses"
        hideInlineLabel={true}
      />
    </div>
  );
}
