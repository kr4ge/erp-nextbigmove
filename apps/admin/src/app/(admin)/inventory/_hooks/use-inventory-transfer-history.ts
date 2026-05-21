'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { fetchWmsInventoryTransfers } from '../_services/inventory.service';

const SEARCH_DEBOUNCE_MS = 300;

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (Array.isArray(payload?.message)) {
      return payload.message.join(' ');
    }

    if (typeof payload?.message === 'string') {
      return payload.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

export function useInventoryTransferHistory(enabled = true) {
  const pageSize = 10;
  const [selectedTenantId, setSelectedTenantId] = useState<string | undefined>();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchText]);

  const historyQuery = useQuery({
    queryKey: [
      'wms-inventory-transfers',
      selectedTenantId ?? 'default-tenant',
      selectedWarehouseId ?? 'all-warehouses',
      debouncedSearchText,
    ],
    queryFn: () =>
      fetchWmsInventoryTransfers({
        tenantId: selectedTenantId,
        warehouseId: selectedWarehouseId,
        search: debouncedSearchText || undefined,
      }),
    enabled,
  });

  useEffect(() => {
    const activeTenantId = historyQuery.data?.filters.activeTenantId;
    const tenants = historyQuery.data?.filters.tenants ?? [];

    if (
      activeTenantId
      && (!selectedTenantId || !tenants.some((tenant) => tenant.id === selectedTenantId))
    ) {
      setSelectedTenantId(activeTenantId);
    }
  }, [historyQuery.data?.filters.activeTenantId, historyQuery.data?.filters.tenants, selectedTenantId]);

  useEffect(() => {
    if (!selectedWarehouseId) {
      const activeWarehouseId = historyQuery.data?.filters.activeWarehouseId;
      if (activeWarehouseId) {
        setSelectedWarehouseId(activeWarehouseId);
      }
      return;
    }

    const warehouses = historyQuery.data?.filters.warehouses ?? [];
    if (warehouses.length > 0 && !warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      setSelectedWarehouseId(undefined);
    }
  }, [historyQuery.data?.filters.activeWarehouseId, historyQuery.data?.filters.warehouses, selectedWarehouseId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTenantId, selectedWarehouseId, debouncedSearchText]);

  const totalPages = useMemo(() => {
    const totalTransfers = historyQuery.data?.transfers.length ?? 0;
    return Math.max(1, Math.ceil(totalTransfers / pageSize));
  }, [historyQuery.data?.transfers.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const transfers = useMemo(() => {
    const items = historyQuery.data?.transfers ?? [];
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [currentPage, historyQuery.data?.transfers]);

  return {
    history: historyQuery.data ?? null,
    transfers,
    isLoading: historyQuery.isLoading,
    isFetching: historyQuery.isFetching,
    errorMessage: historyQuery.error ? getErrorMessage(historyQuery.error) : null,
    selectedTenantId,
    selectedWarehouseId,
    searchText,
    currentPage,
    totalPages,
    setSelectedTenantId: (tenantId: string | undefined) => {
      setSelectedTenantId(tenantId);
      setSelectedWarehouseId(undefined);
    },
    setSelectedWarehouseId,
    setSearchText,
    setCurrentPage,
  };
}
