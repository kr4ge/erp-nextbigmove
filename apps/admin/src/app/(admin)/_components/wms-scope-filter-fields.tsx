'use client';

import { WmsSearchableSelect, type WmsSearchableOption } from './wms-searchable-select';

type WmsScopeFilterFieldsProps = {
  tenantOptions?: WmsSearchableOption[];
  selectedTenantId?: string;
  onTenantChange?: (value: string | undefined) => void;
  storeOptions?: WmsSearchableOption[];
  selectedStoreId?: string;
  onStoreChange: (value: string | undefined) => void;
  warehouseOptions?: WmsSearchableOption[];
  selectedWarehouseId?: string;
  onWarehouseChange?: (value: string | undefined) => void;
};

export function WmsScopeFilterFields({
  tenantOptions = [],
  selectedTenantId,
  onTenantChange,
  storeOptions = [],
  selectedStoreId,
  onStoreChange,
  warehouseOptions = [],
  selectedWarehouseId,
  onWarehouseChange,
}: WmsScopeFilterFieldsProps) {
  return (
    <>
      {onTenantChange ? (
        <WmsSearchableSelect
          label="Tenant"
          value={selectedTenantId ?? ''}
          onChange={(value) => onTenantChange(value || undefined)}
          options={tenantOptions}
          placeholder="Search tenants…"
          allLabel="All tenants"
        />
      ) : null}

      <WmsSearchableSelect
        label="Store"
        value={selectedStoreId ?? ''}
        onChange={(value) => onStoreChange(value || undefined)}
        options={storeOptions}
        placeholder="Search stores…"
        allLabel="All stores"
      />

      {onWarehouseChange ? (
        <WmsSearchableSelect
          label="Warehouse"
          value={selectedWarehouseId ?? ''}
          onChange={(value) => onWarehouseChange(value || undefined)}
          options={warehouseOptions}
          placeholder="Search warehouses…"
          allLabel="All warehouses"
        />
      ) : null}
    </>
  );
}
