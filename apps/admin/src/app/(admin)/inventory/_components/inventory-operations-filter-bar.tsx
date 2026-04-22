'use client';

import { WmsActionBar } from '../../_components/wms-action-bar';
import { WmsSearchableSelect } from '../../_components/wms-searchable-select';

type InventoryOperationsFilterBarProps = {
  filters:
    | {
        tenants: Array<{
          id: string;
          label: string;
        }>;
        stores: Array<{
          id: string;
          label: string;
        }>;
        warehouses: Array<{
          id: string;
          code?: string;
          label: string;
        }>;
      }
    | null
    | undefined;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedTenantId?: string;
  onTenantChange: (value: string | undefined) => void;
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  selectedWarehouseId?: string;
  onWarehouseChange: (value: string | undefined) => void;
};

export function InventoryOperationsFilterBar({
  filters,
  searchText,
  onSearchTextChange,
  selectedTenantId,
  onTenantChange,
  selectedStoreId,
  onStoreChange,
  selectedWarehouseId,
  onWarehouseChange,
}: InventoryOperationsFilterBarProps) {
  return (
    <WmsActionBar
      searchText={searchText}
      onSearchTextChange={onSearchTextChange}
      searchPlaceholder="Search by request, batch, unit, product, or barcode"
    >
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
        }))}
        placeholder="Search stores…"
        allLabel="All stores"
      />

      <WmsSearchableSelect
        label="Warehouse"
        value={selectedWarehouseId ?? ''}
        onChange={(value) => onWarehouseChange(value || undefined)}
        options={(filters?.warehouses ?? []).map((warehouse) => ({
          value: warehouse.id,
          label: warehouse.code ? `${warehouse.code} · ${warehouse.label}` : warehouse.label,
        }))}
        placeholder="Search warehouses…"
        allLabel="All warehouses"
      />
    </WmsActionBar>
  );
}
