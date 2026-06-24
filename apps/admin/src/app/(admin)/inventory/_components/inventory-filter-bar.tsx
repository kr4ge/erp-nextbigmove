'use client';

import { Search, X } from 'lucide-react';
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
  selectedProductValue?: string;
  onProductChange: (product: WmsInventoryOverviewResponse['filters']['products'][number] | undefined) => void;
  selectedWarehouseId?: string;
  onWarehouseChange: (value: string | undefined) => void;
  selectedStatus?: WmsInventoryUnitStatus;
  onStatusChange: (value: WmsInventoryUnitStatus | undefined) => void;
};

function buildInventoryProductFilterValue(
  product: WmsInventoryOverviewResponse['filters']['products'][number],
) {
  return `${product.tenantId}::${product.storeId}::${product.variationId}`;
}

export function InventoryFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedStoreId,
  onStoreChange,
  selectedProductValue,
  onProductChange,
  selectedWarehouseId,
  onWarehouseChange,
  selectedStatus,
  onStatusChange,
}: InventoryFilterBarProps) {
  const products = filters?.products ?? [];

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-[1_1_20rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search by unit, barcode, product, or variation"
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

      <WmsSearchableSelect
        label="Partner"
        value={selectedTenantId ?? ''}
        onChange={(value) => onTenantChange(value || undefined)}
        options={(filters?.tenants ?? []).map((tenant) => ({
          value: tenant.id,
          label: tenant.label,
        }))}
        placeholder="Search partners…"
        allLabel="All partners"
        hideInlineLabel={true}
      />

      <WmsSearchableSelect
        label="Store"
        value={selectedStoreId ?? ''}
        onChange={(value) => onStoreChange(value || undefined)}
        options={(filters?.stores ?? []).map((store) => ({
          value: store.id,
          label: store.label,
          selectedLabel: store.name,
          hint: store.unitCount,
        }))}
        placeholder="Search stores…"
        allLabel="All stores"
        hideInlineLabel={true}
      />

      <WmsSearchableSelect
        label="Product"
        value={selectedProductValue ?? ''}
        onChange={(value) => {
          if (!value) {
            onProductChange(undefined);
            return;
          }

          onProductChange(
            products.find((product) => buildInventoryProductFilterValue(product) === value),
          );
        }}
        options={products.map((product) => ({
          value: buildInventoryProductFilterValue(product),
          label: product.label,
          selectedLabel: product.selectedLabel,
          hint: product.unitCount,
        }))}
        placeholder="Search products…"
        allLabel="All products"
        hideInlineLabel={true}
      />

      <WmsSearchableSelect
        label="Warehouse"
        value={selectedWarehouseId ?? ''}
        onChange={(value) => onWarehouseChange(value || undefined)}
        options={(filters?.warehouses ?? []).map((warehouse) => ({
          value: warehouse.id,
          label: warehouse.label,
          hint: warehouse.unitCount,
        }))}
        placeholder="Search warehouses…"
        allLabel="All warehouses"
        hideInlineLabel={true}
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
        hideInlineLabel={true}
      />
    </div>
  );
}
