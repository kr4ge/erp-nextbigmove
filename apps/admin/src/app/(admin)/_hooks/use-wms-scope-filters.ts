'use client';

import { useCallback, useEffect } from 'react';

type ScopeOption = {
  id: string;
};

type ScopeFilters = {
  tenants?: ScopeOption[] | null;
  stores?: ScopeOption[] | null;
  warehouses?: ScopeOption[] | null;
  activeTenantId?: string | null;
  activeStoreId?: string | null;
  activeWarehouseId?: string | null;
};

type UseWmsScopeFiltersOptions = {
  filters?: ScopeFilters | null;
  selectedTenantId?: string;
  setSelectedTenantIdState: (value: string | undefined) => void;
  selectedStoreId?: string;
  setSelectedStoreIdState: (value: string | undefined) => void;
  selectedWarehouseId?: string;
  setSelectedWarehouseIdState?: (value: string | undefined) => void;
  includeWarehouse?: boolean;
  autoSelectWarehouseOnStoreChange?: boolean;
};

export function useWmsScopeFilters({
  filters,
  selectedTenantId,
  setSelectedTenantIdState,
  selectedStoreId,
  setSelectedStoreIdState,
  selectedWarehouseId,
  setSelectedWarehouseIdState,
  includeWarehouse = false,
  autoSelectWarehouseOnStoreChange = false,
}: UseWmsScopeFiltersOptions) {
  useEffect(() => {
    const activeTenantId = filters?.activeTenantId;
    const tenants = filters?.tenants;

    if (
      activeTenantId
      && (!selectedTenantId || !tenants?.some((tenant) => tenant.id === selectedTenantId))
    ) {
      setSelectedTenantIdState(activeTenantId);
    }
  }, [filters?.activeTenantId, filters?.tenants, selectedTenantId, setSelectedTenantIdState]);

  useEffect(() => {
    const activeStoreId = filters?.activeStoreId;
    const stores = filters?.stores;

    if (
      activeStoreId
      && (!selectedStoreId || !stores?.some((store) => store.id === selectedStoreId))
    ) {
      setSelectedStoreIdState(activeStoreId);
    }
  }, [filters?.activeStoreId, filters?.stores, selectedStoreId, setSelectedStoreIdState]);

  useEffect(() => {
    if (!selectedStoreId) {
      return;
    }

    const stores = filters?.stores;
    if (!stores) {
      return;
    }

    if (!stores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreIdState(undefined);
    }
  }, [filters?.stores, selectedStoreId, setSelectedStoreIdState]);

  useEffect(() => {
    if (!includeWarehouse) {
      return;
    }

    const activeWarehouseId = filters?.activeWarehouseId;
    const warehouses = filters?.warehouses;

    if (
      activeWarehouseId
      && (!selectedWarehouseId || !warehouses?.some((warehouse) => warehouse.id === selectedWarehouseId))
    ) {
      setSelectedWarehouseIdState?.(activeWarehouseId);
    }
  }, [filters?.activeWarehouseId, filters?.warehouses, includeWarehouse, selectedWarehouseId, setSelectedWarehouseIdState]);

  useEffect(() => {
    if (!includeWarehouse || !selectedWarehouseId) {
      return;
    }

    const warehouses = filters?.warehouses;
    if (!warehouses) {
      return;
    }

    if (!warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      setSelectedWarehouseIdState?.(undefined);
    }
  }, [filters?.warehouses, includeWarehouse, selectedWarehouseId, setSelectedWarehouseIdState]);

  useEffect(() => {
    if (
      !includeWarehouse
      || !autoSelectWarehouseOnStoreChange
      || !selectedStoreId
      || selectedWarehouseId
    ) {
      return;
    }

    const warehouses = filters?.warehouses ?? [];
    if (warehouses.length === 0) {
      return;
    }

    const nextWarehouseId =
      (filters?.activeWarehouseId && warehouses.some((warehouse) => warehouse.id === filters.activeWarehouseId)
        ? filters.activeWarehouseId
        : null)
      ?? warehouses[0]?.id
      ?? null;

    if (nextWarehouseId) {
      setSelectedWarehouseIdState?.(nextWarehouseId);
    }
  }, [
    autoSelectWarehouseOnStoreChange,
    filters?.activeWarehouseId,
    filters?.warehouses,
    includeWarehouse,
    selectedStoreId,
    selectedWarehouseId,
    setSelectedWarehouseIdState,
  ]);

  const setSelectedTenantId = useCallback((tenantId: string | undefined) => {
    setSelectedTenantIdState(tenantId);
    setSelectedStoreIdState(undefined);
    if (includeWarehouse) {
      setSelectedWarehouseIdState?.(undefined);
    }
  }, [includeWarehouse, setSelectedTenantIdState, setSelectedStoreIdState, setSelectedWarehouseIdState]);

  const setSelectedStoreId = useCallback(
    (storeId: string | undefined) => {
      setSelectedStoreIdState(storeId);
      if (includeWarehouse) {
        setSelectedWarehouseIdState?.(undefined);
      }
    },
    [includeWarehouse, setSelectedStoreIdState, setSelectedWarehouseIdState],
  );

  const setSelectedWarehouseId = useCallback(
    (warehouseId: string | undefined) => {
      setSelectedWarehouseIdState?.(warehouseId);
    },
    [setSelectedWarehouseIdState],
  );

  return {
    setSelectedTenantId,
    setSelectedStoreId,
    setSelectedWarehouseId,
  };
}
