'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ShopOption } from '../_types/confirmation';
import {
  fetchAgingOrdersSummary,
  markAgingOrdersSummaryNotificationRead,
} from '../_services/summary-api';
import { ORDER_SUMMARY_NOTIFICATION_COUNT_QUERY_KEY } from './use-order-summary-notification-count';
import { useOrderSummaryRealtime } from './use-order-summary-realtime';
import type {
  AgingOrdersSummaryResponse,
  AgingOrdersSummaryRow,
} from '../_types/summary';

export type AgingOrdersSummarySortKey =
  | 'index'
  | 'shop'
  | 'total_orders'
  | 'new_orders'
  | 'restocking'
  | 'confirmed'
  | 'printed'
  | 'waiting_pickup'
  | 'shipped'
  | 'rts';

const PAGE_SIZE = 10;

const sortValueMap: Record<Exclude<AgingOrdersSummarySortKey, 'index'>, (row: AgingOrdersSummaryRow) => number | string> = {
  shop: (row) => row.shop_name,
  total_orders: (row) => row.total_orders,
  new_orders: (row) => row.new_orders,
  restocking: (row) => row.restocking,
  confirmed: (row) => row.confirmed,
  printed: (row) => row.printed,
  waiting_pickup: (row) => row.waiting_pickup,
  shipped: (row) => row.shipped,
  rts: (row) => row.rts,
};

export function useAgingOrdersSummary(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<AgingOrdersSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<AgingOrdersSummarySortKey>('total_orders');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [markingShopId, setMarkingShopId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchAgingOrdersSummary(2);
      setData(next);
    } catch (loadError: unknown) {
      const message =
        typeof loadError === 'object'
        && loadError !== null
        && 'response' in loadError
        && typeof (loadError as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (loadError as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to load aging orders summary.';
      setError(message || 'Failed to load aging orders summary.');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

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
    onUpdate: () => {
      void load();
    },
  });

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

  const filteredRows = useMemo(() => {
    const items = data?.items || [];
    if (isAllShopsMode) return items;
    const selectedSet = new Set(selectedShops);
    return items.filter((row) => selectedSet.has(row.shop_id));
  }, [data?.items, isAllShopsMode, selectedShops]);

  const sortedRows = useMemo(() => {
    const next = [...filteredRows];
    if (sortKey === 'index') return next;

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
  }, [filteredRows, sortDir, sortKey]);

  const totalRows = sortedRows.length;
  const totalPages = totalRows === 0 ? 1 : Math.ceil(totalRows / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
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

  const handleSort = useCallback((key: AgingOrdersSummarySortKey) => {
    setPage(1);
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((currentDir) => (currentDir === 'asc' ? 'desc' : 'asc'));
        return currentKey;
      }
      setSortDir(key === 'shop' || key === 'index' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const hasShopUnread = useCallback(
    (shopId: string) => data?.notification_cells?.[shopId] === true,
    [data?.notification_cells],
  );

  const markShopRead = useCallback(async (shopId: string) => {
    if (!data?.notification_cells?.[shopId] || markingShopId === shopId) {
      return;
    }

    setMarkingShopId(shopId);

    try {
      await markAgingOrdersSummaryNotificationRead(shopId);

      setData((current) => {
        if (!current?.notification_cells?.[shopId]) {
          return current;
        }

        const nextCells = { ...current.notification_cells };
        delete nextCells[shopId];

        return {
          ...current,
          notification_cells: nextCells,
        };
      });

      void queryClient.invalidateQueries({
        queryKey: ORDER_SUMMARY_NOTIFICATION_COUNT_QUERY_KEY,
      });
    } catch {
      void load();
    } finally {
      setMarkingShopId((current) => (current === shopId ? null : current));
    }
  }, [data?.notification_cells, load, markingShopId, queryClient]);

  return {
    data,
    isLoading,
    error,
    thresholdDays: data?.selected.threshold_days ?? 2,
    generatedAt: data?.generated_at ?? null,
    page: safePage,
    pageSize: PAGE_SIZE,
    totalPages,
    totalRows,
    rows: pagedRows,
    sourceCount: filteredRows.length,
    start,
    end,
    canPrevious: safePage > 1,
    canNext: safePage < totalPages,
    onPrevious: () => setPage((current) => Math.max(1, current - 1)),
    onNext: () => setPage((current) => Math.min(totalPages, current + 1)),
    sortKey,
    sortDir,
    handleSort,
    hasShopUnread,
    markShopRead,
    markingShopId,
    shopPickerOptions,
    selectedShopLabel,
    isAllShopsMode,
    resolvedShopIds,
    toggleShop,
    setOnlyShop: (shopId: string) => {
      setIsAllShopsMode(false);
      setSelectedShops([shopId]);
      setPage(1);
    },
    clearShopFilter: () => {
      setIsAllShopsMode(true);
      setSelectedShops([]);
      setPage(1);
    },
    setAllShopsMode: (checked: boolean) => {
      setIsAllShopsMode(checked);
      setSelectedShops([]);
      setPage(1);
    },
  };
}
