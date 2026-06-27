'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchOrderStatusSummary } from '../_services/summary-api';
import { useOrderSummaryRealtime } from './use-order-summary-realtime';
import type { OrderStatusSummaryResponse, OrderStatusSummaryRow } from '../_types/summary';
import type { ShopOption } from '../_types/confirmation';

export type OrderStatusSummarySortKey =
  | 'shop'
  | 'new_orders'
  | 'restocking'
  | 'confirmed'
  | 'printed'
  | 'waiting_pickup'
  | 'shipped'
  | 'delivered'
  | 'returning'
  | 'returned'
  | 'cancelled'
  | 'deleted'
  | 'total_orders';

const PAGE_SIZE = 10;

const sortValueMap: Record<OrderStatusSummarySortKey, (row: OrderStatusSummaryRow) => number | string> = {
  shop: (row) => row.shop_name,
  new_orders: (row) => row.new_orders,
  restocking: (row) => row.restocking,
  confirmed: (row) => row.confirmed,
  printed: (row) => row.printed,
  waiting_pickup: (row) => row.waiting_pickup,
  shipped: (row) => row.shipped,
  delivered: (row) => row.delivered,
  returning: (row) => row.returning,
  returned: (row) => row.returned,
  cancelled: (row) => row.cancelled,
  deleted: (row) => row.deleted,
  total_orders: (row) => row.total_orders,
};

export function useOrderStatusSummary(dateLocal: string, enabled: boolean = true) {
  const [data, setData] = useState<OrderStatusSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<OrderStatusSummarySortKey>('total_orders');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);

  const shopOptions = useMemo<ShopOption[]>(
    () => data?.filters.shops || [],
    [data?.filters.shops],
  );

  const shopPickerOptions = useMemo(
    () => shopOptions.map((shop) => ({ value: shop.shop_id, label: shop.shop_name })),
    [shopOptions],
  );

  const resolvedShopIds = useMemo(
    () => (isAllShopsMode ? shopOptions.map((shop) => shop.shop_id) : selectedShops),
    [isAllShopsMode, selectedShops, shopOptions],
  );

  const selectedShopLabel = isAllShopsMode ? 'All shops' : `${selectedShops.length} selected`;

  const load = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchOrderStatusSummary({
        dateLocal,
        shopIds: isAllShopsMode ? [] : selectedShops,
      });
      setData(next);
    } catch (loadError: unknown) {
      const message =
        typeof loadError === 'object'
        && loadError !== null
        && 'response' in loadError
        && typeof (loadError as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (loadError as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load orders summary.';
      setError(message || 'Failed to load orders summary.');
    } finally {
      setIsLoading(false);
    }
  }, [dateLocal, enabled, isAllShopsMode, selectedShops]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleTeamScopeChanged = () => {
      void load();
    };

    window.addEventListener('teamScopeChanged', handleTeamScopeChanged as EventListener);
    return () => {
      window.removeEventListener('teamScopeChanged', handleTeamScopeChanged as EventListener);
    };
  }, [load]);

  useOrderSummaryRealtime({
    enabled,
    events: ['orders:summary:status:updated'],
    onUpdate: () => {
      void load();
    },
  });

  const toggleShop = useCallback((shopId: string) => {
    if (isAllShopsMode) {
      const next = shopOptions.map((shop) => shop.shop_id).filter((id) => id !== shopId);
      if (next.length === 0) {
        setIsAllShopsMode(true);
        setSelectedShops([]);
      } else {
        setIsAllShopsMode(false);
        setSelectedShops(next);
      }
      setPage(1);
      return;
    }

    const exists = selectedShops.includes(shopId);
    const next = exists
      ? selectedShops.filter((id) => id !== shopId)
      : [...selectedShops, shopId];

    if (next.length === 0 || next.length === shopOptions.length) {
      setIsAllShopsMode(true);
      setSelectedShops([]);
    } else {
      setSelectedShops(next);
    }
    setPage(1);
  }, [isAllShopsMode, selectedShops, shopOptions]);

  const setOnlyShop = useCallback((shopId: string) => {
    setIsAllShopsMode(false);
    setSelectedShops([shopId]);
    setPage(1);
  }, []);

  const clearShopFilter = useCallback(() => {
    setIsAllShopsMode(true);
    setSelectedShops([]);
    setPage(1);
  }, []);

  const sortedRows = useMemo(() => {
    const next = [...(data?.items || [])];
    next.sort((a, b) => {
      const left = sortValueMap[sortKey](a);
      const right = sortValueMap[sortKey](b);

      if (typeof left === 'string' && typeof right === 'string') {
        const result = left.localeCompare(right);
        return sortDir === 'asc' ? result : -result;
      }

      const result = Number(left) - Number(right);
      return sortDir === 'asc' ? result : -result;
    });
    return next;
  }, [data?.items, sortDir, sortKey]);

  const totalRows = sortedRows.length;
  const totalPages = totalRows === 0 ? 1 : Math.ceil(totalRows / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(
    () => sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [safePage, sortedRows],
  );
  const start = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = totalRows === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalRows);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const handleSort = useCallback((key: OrderStatusSummarySortKey) => {
    setPage(1);
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((currentDir) => (currentDir === 'asc' ? 'desc' : 'asc'));
        return currentKey;
      }
      setSortDir(key === 'shop' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  return {
    data,
    isLoading,
    error,
    generatedAt: data?.generated_at ?? null,
    reload: load,
    shopPickerOptions,
    selectedShopLabel,
    resolvedShopIds,
    isAllShopsMode,
    rows,
    totalRows,
    totalPages,
    page: safePage,
    start,
    end,
    canPrevious: safePage > 1,
    canNext: safePage < totalPages,
    onPrevious: () => setPage((current) => Math.max(1, current - 1)),
    onNext: () => setPage((current) => Math.min(totalPages, current + 1)),
    sortKey,
    sortDir,
    handleSort,
    toggleShop,
    setAllShopsMode: (checked: boolean) => {
      setIsAllShopsMode(checked);
      setSelectedShops([]);
      setPage(1);
    },
    setOnlyShop,
    clearShopFilter,
  };
}
