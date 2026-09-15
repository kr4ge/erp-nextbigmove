'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMonthEndStockReport } from '../_services/month-end-stock-report.service';
import type { MonthEndStockReportResponse } from '../_types/month-end-stock-report';

export function useMonthEndStockReport() {
  const requestIdRef = useRef(0);
  const [data, setData] = useState<MonthEndStockReportResponse | null>(null);
  const [selectedTenantIds, setSelectedTenantIdsState] = useState<string[]>([]);
  const [selectedStoreIds, setSelectedStoreIdsState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableStores = useMemo(() => {
    const stores = data?.filters.stores ?? [];
    if (selectedTenantIds.length === 0) return stores;
    const selectedTenants = new Set(selectedTenantIds);
    return stores.filter((store) => selectedTenants.has(store.tenantId));
  }, [data?.filters.stores, selectedTenantIds]);

  const setSelectedTenantIds = useCallback((tenantIds: string[]) => {
    setSelectedTenantIdsState(tenantIds);
    // Partner is the parent scope. Reset the child to its default "all stores"
    // whenever the partner perimeter changes.
    setSelectedStoreIdsState([]);
  }, []);

  const setSelectedStoreIds = useCallback((storeIds: string[]) => {
    const availableStoreIds = new Set(availableStores.map((store) => store.id));
    setSelectedStoreIdsState(storeIds.filter((storeId) => availableStoreIds.has(storeId)));
  }, [availableStores]);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchMonthEndStockReport({
        tenantIds: selectedTenantIds,
        storeIds: selectedStoreIds,
      });
      if (requestIdRef.current !== requestId) return;
      setData(response);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      setError(resolveErrorMessage(loadError));
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, [selectedStoreIds, selectedTenantIds]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return {
    data,
    selectedTenantIds,
    selectedStoreIds,
    availableStores,
    isLoading,
    error,
    setSelectedTenantIds,
    setSelectedStoreIds,
    refresh: load,
  };
}

function resolveErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null) {
    const response = 'response' in error ? error.response : null;
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data;
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const message = data.message;
        if (Array.isArray(message)) return message.join(', ');
        if (typeof message === 'string') return message;
      }
    }
  }
  return error instanceof Error ? error.message : 'Unable to load the month-end stock report.';
}
