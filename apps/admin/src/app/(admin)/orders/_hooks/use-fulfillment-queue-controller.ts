'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WmsSearchableOption } from '../../_components/wms-searchable-select';
import { useWmsScopeFilters } from '../../_hooks/use-wms-scope-filters';
import {
  fetchWmsPackQueue,
  fetchWmsPickQueue,
  reallocateWmsPickQueue,
  resyncWmsPickQueue,
  voidWmsPickBasket,
} from '../_services/fulfillment.service';
import type {
  WmsFulfillmentPackStatus,
  WmsFulfillmentPickStatus,
  WmsFulfillmentQueueMode,
  WmsFulfillmentQueueResponse,
  WmsFulfillmentQueueScope,
} from '../_types/fulfillment';

const PICK_STATUS_OPTIONS: Array<{ value: WmsFulfillmentPickStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'READY', label: 'Ready' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'RESTOCKING', label: 'Restocking' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'IN_PICKING', label: 'In Picking' },
  { value: 'READY_FOR_PACK', label: 'Ready for Pack' },
  { value: 'PICKED', label: 'Picked' },
];

const PACK_STATUS_OPTIONS: Array<{ value: WmsFulfillmentPackStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PICKED', label: 'Picked' },
  { value: 'PACKING', label: 'Packing' },
  { value: 'AWAITING_TRACKING', label: 'Awaiting Tracking' },
  { value: 'PACKED', label: 'Packed' },
];

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export function useFulfillmentQueueController(mode: WmsFulfillmentQueueMode) {
  const [data, setData] = useState<WmsFulfillmentQueueResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isReallocating, setIsReallocating] = useState(false);
  const [isVoidingBasket, setIsVoidingBasket] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTenantIdState, setSelectedTenantIdState] = useState<string | undefined>(undefined);
  const [selectedStoreIdState, setSelectedStoreIdState] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchText]);

  const {
    setSelectedTenantId,
    setSelectedStoreId,
  } = useWmsScopeFilters({
    filters: data?.context
      ? {
        tenants: data.context.tenantOptions?.map((tenant) => ({ id: tenant.id })) ?? [],
        stores: data.context.stores.map((store) => ({
          id: store.id,
          tenantId: store.tenantId ?? null,
        })),
        activeTenantId: data.context.activeTenantId,
        activeStoreId: data.context.activeStoreId,
      }
      : null,
    selectedTenantId: selectedTenantIdState,
    setSelectedTenantIdState,
    selectedStoreId: selectedStoreIdState,
    setSelectedStoreIdState,
  });

  const statusOptions = mode === 'pick' ? PICK_STATUS_OPTIONS : PACK_STATUS_OPTIONS;

  const fetchQueue = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const nextData = mode === 'pick'
        ? await fetchWmsPickQueue({
          tenantId: selectedTenantIdState,
          storeId: selectedStoreIdState,
          status: (selectedStatus || undefined) as WmsFulfillmentPickStatus | undefined,
          search: debouncedSearchText || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE,
          ownedOnly,
        })
        : await fetchWmsPackQueue({
          tenantId: selectedTenantIdState,
          storeId: selectedStoreIdState,
          status: (selectedStatus || undefined) as WmsFulfillmentPackStatus | undefined,
          search: debouncedSearchText || undefined,
          page: currentPage,
          pageSize: PAGE_SIZE,
        });

      setData(nextData);
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    currentPage,
    mode,
    ownedOnly,
    debouncedSearchText,
    selectedStatus,
    selectedStoreIdState,
    selectedTenantIdState,
  ]);

  useEffect(() => {
    void fetchQueue(false);
  }, [fetchQueue]);

  const resyncPickQueue = useCallback(async () => {
    if (mode !== 'pick') {
      return false;
    }

    setIsResyncing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const result = await resyncWmsPickQueue({
        tenantId: selectedTenantIdState,
        storeId: selectedStoreIdState,
      });

      await fetchQueue(true);

      const scopeLabel = result.storeName
        ? `for ${result.storeName}`
        : result.storeCount === 1
          ? 'for 1 active store'
          : `across ${result.storeCount} active stores`;

      setNotice({
        tone: result.syncedOrders > 0 ? 'success' : 'info',
        message: `Pick queue resynced ${scopeLabel}. ${result.syncedOrders} confirmed order${result.syncedOrders === 1 ? '' : 's'} reconciled.`,
      });
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsResyncing(false);
    }
  }, [fetchQueue, mode, selectedStoreIdState, selectedTenantIdState]);

  const reallocatePickQueue = useCallback(async () => {
    if (mode !== 'pick') {
      return false;
    }

    setIsReallocating(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const result = await reallocateWmsPickQueue({
        tenantId: selectedTenantIdState,
        storeId: selectedStoreIdState,
      });

      await fetchQueue(true);

      const scopeLabel = result.storeName
        ? `for ${result.storeName}`
        : result.storeCount === 1
          ? 'for 1 active store'
          : `across ${result.storeCount} active stores`;

      setNotice({
        tone: result.checkedOrders > 0 ? 'success' : 'info',
        message: `Waiting pick orders rechecked ${scopeLabel}. ${result.checkedOrders} order${result.checkedOrders === 1 ? '' : 's'} retried for allocation.`,
      });
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsReallocating(false);
    }
  }, [fetchQueue, mode, selectedStoreIdState, selectedTenantIdState]);

  const voidPickBasket = useCallback(async (basketId: string) => {
    if (mode !== 'pick') {
      return false;
    }

    setIsVoidingBasket(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const result = await voidWmsPickBasket({
        basketId,
        tenantId: selectedTenantIdState ?? null,
      });

      await fetchQueue(true);

      const detailParts = [
        `${result.releasedUnits} unit${result.releasedUnits === 1 ? '' : 's'} returned to bin`,
        `${result.resetOrders} order${result.resetOrders === 1 ? '' : 's'} reset`,
      ];
      if (result.detachedPackedUnits > 0) {
        detailParts.push(`${result.detachedPackedUnits} packed unit${result.detachedPackedUnits === 1 ? '' : 's'} detached from basket history`);
      }
      if (result.canceledOrders > 0) {
        detailParts.push(`${result.canceledOrders} order${result.canceledOrders === 1 ? '' : 's'} removed from queue`);
      }

      setNotice({
        tone: 'success',
        message: `Basket ${result.basket.barcode} was voided. ${detailParts.join(' · ')}.`,
      });
      return true;
    } catch (error) {
      setErrorMessage(resolveQueueError(error));
      return false;
    } finally {
      setIsVoidingBasket(false);
    }
  }, [fetchQueue, mode, selectedTenantIdState]);

  useEffect(() => {
    if (mode !== 'pick' || ownedOnly || !data?.context) {
      return;
    }

    if (data.context.taskAssignment === 'PICK' && data.context.canViewAllQueue === false) {
      setCurrentPage(1);
      setOwnedOnly(true);
    }
  }, [data?.context, mode, ownedOnly]);

  const queueScope: WmsFulfillmentQueueScope = data?.context?.canViewAllQueue === false ? 'own' : 'all';
  const requiresTenantSelectionForResync = mode === 'pick'
    && !data?.context?.activeTenantId
    && (data?.context?.tenantOptions?.length ?? 0) > 0;

  const tenantOptions = useMemo<WmsSearchableOption[]>(
    () => (data?.context.tenantOptions ?? []).map((tenant) => ({
      value: tenant.id,
      label: tenant.name,
      hint: tenant.slug,
    })),
    [data?.context.tenantOptions],
  );

  const storeOptions = useMemo<WmsSearchableOption[]>(
    () => data?.context.stores.map((store) => ({
      value: store.id,
      label: store.name,
      hint: store.tenantName ?? undefined,
    })) ?? [],
    [data?.context.stores],
  );

  const summaryItems = useMemo(() => {
    const summary = data?.summary ?? {};

    if (mode === 'pick') {
      return [
        { id: 'ready', label: 'Ready', value: summary.ready ?? 0 },
        { id: 'partial', label: 'Partial', value: summary.partial ?? 0 },
        { id: 'restocking', label: 'Restocking', value: summary.restocking ?? 0 },
        { id: 'inPicking', label: 'In Picking', value: summary.inPicking ?? 0 },
      ];
    }

    return [
      { id: 'held', label: 'Held', value: summary.held ?? 0 },
      { id: 'packing', label: 'Packing', value: summary.packing ?? 0 },
      { id: 'awaitingTracking', label: 'Awaiting Tracking', value: summary.awaitingTracking ?? 0 },
      { id: 'packed', label: 'Packed', value: data?.tasks.filter((task) => task.status === 'PACKED').length ?? 0 },
    ];
  }, [data?.summary, data?.tasks, mode]);

  return {
    currentPage,
    data,
    errorMessage,
    isLoading,
    isReallocating,
    isRefreshing,
    isResyncing,
    isVoidingBasket,
    mode,
    notice,
    queueScope,
    requiresTenantSelectionForResync,
    searchText,
    selectedStatus,
    selectedStoreId: selectedStoreIdState,
    selectedTenantId: selectedTenantIdState,
    clearNotice: () => setNotice(null),
    setCurrentPage,
    setSearchText: (value: string) => {
      setCurrentPage(1);
      setSearchText(value);
    },
    setSelectedStatus: (value: string) => {
      setCurrentPage(1);
      setSelectedStatus(value);
    },
    setSelectedStoreId: (value: string | undefined) => {
      setCurrentPage(1);
      setSelectedStoreId(value);
    },
    setSelectedTenantId: (value: string | undefined) => {
      setCurrentPage(1);
      setOwnedOnly(false);
      setSelectedTenantId(value);
    },
    statusOptions,
    storeOptions,
    summaryItems,
    heldBaskets: data?.heldBaskets ?? [],
    tasks: data?.tasks ?? [],
    tenantOptions,
    tenantReady: data?.tenantReady ?? false,
    totalPages: Math.max(1, Math.ceil((data?.pagination.total ?? 0) / (data?.pagination.pageSize ?? PAGE_SIZE))),
    refresh: () => fetchQueue(true),
    reallocatePickQueue,
    resyncPickQueue,
    voidPickBasket,
  };
}

function resolveQueueError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to load fulfillment queue.'
    : 'Unable to load fulfillment queue.';
}
