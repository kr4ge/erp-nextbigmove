'use client';

import { WmsActionBar } from '../../_components/wms-action-bar';
import { WmsScopeFilterFields } from '../../_components/wms-scope-filter-fields';

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
        }))}
        selectedStoreId={selectedStoreId}
        onStoreChange={onStoreChange}
        warehouseOptions={(filters?.warehouses ?? []).map((warehouse) => ({
          value: warehouse.id,
          label: warehouse.code ? `${warehouse.code} · ${warehouse.label}` : warehouse.label,
        }))}
        selectedWarehouseId={selectedWarehouseId}
        onWarehouseChange={onWarehouseChange}
      />
    </WmsActionBar>
  );
}
