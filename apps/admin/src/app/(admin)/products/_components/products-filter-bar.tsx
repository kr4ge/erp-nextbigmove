'use client';

import { Search, X } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="wms-pill-control flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 text-[#12384b]">
        <Search className="h-4 w-4 text-[#8193a0]" />
        <input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by variation, product, or custom ID"
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

      <WmsSearchableSelect
        label="Tenant"
        value={selectedTenantId ?? ''}
        onChange={(value) => onTenantChange(value || undefined)}
        options={(filters?.tenants ?? []).map((tenant) => ({
          value: tenant.id,
          label: tenant.label,
        }))}
        placeholder="Search tenants…"
        allLabel="All tenants"
      />

      <WmsSearchableSelect
        label="Store"
        value={selectedStoreId ?? ''}
        onChange={(value) => onStoreChange(value || undefined)}
        options={(filters?.stores ?? []).map((store) => ({
          value: store.id,
          label: store.label,
          hint: store.productCount,
        }))}
        placeholder="Search stores…"
        allLabel="All stores"
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
      />
    </div>
  );
}
