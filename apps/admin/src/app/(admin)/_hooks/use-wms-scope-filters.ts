'use client';

import { useCallback, useEffect, useRef } from 'react';

type ScopeOption = {
  id: string;
  tenantId?: string | null;
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
  allowAllTenants?: boolean;
};

function syncTenantScopeStorage(tenantId: string | undefined) {
  if (typeof window === 'undefined') {
    return;
  }

  if (tenantId) {
    localStorage.setItem('current_tenant_id', tenantId);
  } else {
    localStorage.removeItem('current_tenant_id');
  }

  window.dispatchEvent(new CustomEvent('wmsTenantScopeChanged', { detail: tenantId ?? null }));
}

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
  allowAllTenants = false,
}: UseWmsScopeFiltersOptions) {
  const tenantSelectionInitializedRef = useRef(false);

  useEffect(() => {
    const activeTenantId = filters?.activeTenantId;
    const tenants = filters?.tenants;
    const selectedTenantExists = Boolean(
      selectedTenantId && tenants?.some((tenant) => tenant.id === selectedTenantId),
    );

    if (
      activeTenantId
      && (!selectedTenantId || !selectedTenantExists)
    ) {
      if (allowAllTenants && tenantSelectionInitializedRef.current && !selectedTenantId) {
        return;
      }

      const tenantChanged = selectedTenantId !== activeTenantId;
      syncTenantScopeStorage(activeTenantId);
      setSelectedTenantIdState(activeTenantId);
      if (tenantChanged) {
        setSelectedStoreIdState(undefined);
        if (includeWarehouse) {
          setSelectedWarehouseIdState?.(undefined);
        }
      }
      tenantSelectionInitializedRef.current = true;
      return;
    }

    if (tenants && selectedTenantId && !selectedTenantExists) {
      syncTenantScopeStorage(undefined);
      setSelectedTenantIdState(undefined);
      setSelectedStoreIdState(undefined);
      if (includeWarehouse) {
        setSelectedWarehouseIdState?.(undefined);
      }
      tenantSelectionInitializedRef.current = true;
      return;
    }

    if (tenants) {
      tenantSelectionInitializedRef.current = true;
    }
  }, [
    allowAllTenants,
    filters?.activeTenantId,
    filters?.tenants,
    includeWarehouse,
    selectedTenantId,
    setSelectedStoreIdState,
    setSelectedTenantIdState,
    setSelectedWarehouseIdState,
  ]);

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
    tenantSelectionInitializedRef.current = true;
    syncTenantScopeStorage(tenantId);
    setSelectedTenantIdState(tenantId);
    setSelectedStoreIdState(undefined);
    if (includeWarehouse) {
      setSelectedWarehouseIdState?.(undefined);
    }
  }, [includeWarehouse, setSelectedTenantIdState, setSelectedStoreIdState, setSelectedWarehouseIdState]);

  const setSelectedStoreId = useCallback(
    (storeId: string | undefined) => {
      if (storeId) {
        const matchingStore = filters?.stores?.find((store) => store.id === storeId);
        const nextTenantId = matchingStore?.tenantId ?? undefined;

        if (nextTenantId && nextTenantId !== selectedTenantId) {
          syncTenantScopeStorage(nextTenantId);
          setSelectedTenantIdState(nextTenantId);
        }
      }

      setSelectedStoreIdState(storeId);
      if (includeWarehouse) {
        setSelectedWarehouseIdState?.(undefined);
      }
    },
    [
      filters?.stores,
      includeWarehouse,
      selectedTenantId,
      setSelectedStoreIdState,
      setSelectedTenantIdState,
      setSelectedWarehouseIdState,
    ],
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
