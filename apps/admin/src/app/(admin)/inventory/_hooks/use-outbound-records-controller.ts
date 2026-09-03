'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import { fetchWmsOutboundRecords } from '../_services/outbound-records.service';
import type {
  OutboundDateRange,
  WmsOutboundUnitRecord,
  WmsOutboundUnitStatus,
} from '../_types/outbound-records';
import { getDefaultOutboundDateRange } from '../_utils/outbound-records-presenters';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export function useOutboundRecordsController() {
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | undefined>();
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | undefined>();
  const [selectedProductProfileId, setSelectedProductProfileId] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<WmsOutboundUnitStatus | undefined>();
  const [dateRange, setDateRange] = useState<OutboundDateRange>(getDefaultOutboundDateRange);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<WmsOutboundUnitRecord | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const recordsQuery = useQuery({
    queryKey: [
      'wms-outbound-records',
      selectedTenantId ?? 'all-tenants',
      selectedStoreId ?? 'all-stores',
      selectedProductProfileId ?? 'all-products',
      selectedStatus ?? 'all-statuses',
      dateRange.startDate,
      dateRange.endDate,
      debouncedSearch,
      currentPage,
      PAGE_SIZE,
    ],
    queryFn: () => fetchWmsOutboundRecords({
      allTenants: !selectedTenantId,
      tenantId: selectedTenantId,
      storeId: selectedStoreId,
      productProfileId: selectedProductProfileId,
      status: selectedStatus,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      search: debouncedSearch || undefined,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: (previous) => previous,
  });

  const scopeFilters = useWmsScopeFilters({
    filters: recordsQuery.data?.filters,
    selectedTenantId,
    setSelectedTenantIdState,
    selectedStoreId,
    setSelectedStoreIdState,
    allowAllTenants: true,
  });

  const setSelectedTenantId = useCallback((tenantId: string | undefined) => {
    setSelectedProductProfileId(undefined);
    scopeFilters.setSelectedTenantId(tenantId);
  }, [scopeFilters]);

  const setSelectedStoreId = useCallback((storeId: string | undefined) => {
    setSelectedProductProfileId(undefined);
    scopeFilters.setSelectedStoreId(storeId);
  }, [scopeFilters]);

  useEffect(() => {
    if (!selectedProductProfileId || !recordsQuery.data?.filters.products) return;
    if (!recordsQuery.data.filters.products.some((product) => product.id === selectedProductProfileId)) {
      setSelectedProductProfileId(undefined);
    }
  }, [recordsQuery.data?.filters.products, selectedProductProfileId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedTenantId,
    selectedStoreId,
    selectedProductProfileId,
    selectedStatus,
    dateRange.startDate,
    dateRange.endDate,
    debouncedSearch,
  ]);

  const totalPages = recordsQuery.data?.pagination.totalPages ?? 1;
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const errorMessage = useMemo(() => {
    const error = recordsQuery.error;
    if (!error) return null;
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      return Array.isArray(message) ? message.join(' ') : message || error.message;
    }
    return error instanceof Error ? error.message : 'Outbound records could not load';
  }, [recordsQuery.error]);

  return {
    response: recordsQuery.data ?? null,
    records: recordsQuery.data?.records ?? [],
    isLoading: recordsQuery.isLoading,
    isFetching: recordsQuery.isFetching,
    errorMessage,
    selectedTenantId,
    setSelectedTenantId,
    selectedStoreId,
    setSelectedStoreId,
    selectedProductProfileId,
    setSelectedProductProfileId,
    selectedStatus,
    setSelectedStatus,
    dateRange,
    setDateRange,
    searchText,
    setSearchText,
    currentPage,
    setCurrentPage,
    totalPages,
    selectedRecord,
    setSelectedRecord,
    refresh: recordsQuery.refetch,
  };
}
