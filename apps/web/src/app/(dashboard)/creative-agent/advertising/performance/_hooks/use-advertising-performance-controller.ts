'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { manilaDaysAgo, manilaToday } from '../../_utils/manila-date';
import {
  DEFAULT_VISIBLE_COLUMN_KEYS,
  PERFORMANCE_COLUMN_STORAGE_KEY,
  PERFORMANCE_COLUMNS,
} from '../_constants/performance-columns';
import {
  fetchAdvertisingPerformance,
  linkMetaAdToCreative,
  transitionCreativePerformanceStatus,
  unlinkMetaAd,
} from '../_services/advertising-performance.service';
import type {
  PerformanceGroup,
  PerformanceParams,
  PerformanceResponse,
  PerformanceRow,
} from '../_types/advertising-performance';

export type PerformanceInitialFilters = {
  group?: string;
  linkStatus?: string;
  verdict?: string;
  adId?: string;
  creativeId?: string;
  campaignId?: string;
};

function buildDefaultParams(initial: PerformanceInitialFilters): PerformanceParams {
  const group = ['ADS', 'CAMPAIGNS', 'CREATIVES'].includes(initial.group ?? '')
    ? (initial.group as PerformanceGroup)
    : 'ADS';
  return {
    startDate: manilaDaysAgo(29),
    endDate: manilaToday(),
    query: '',
    storeId: '',
    accountId: '',
    adId: initial.adId ?? '',
    campaignId: initial.campaignId ?? '',
    creativeId: initial.creativeId ?? '',
    group,
    verdict: ['NEEDS_ACTION', 'SCALE', 'WATCH', 'KILL'].includes(initial.verdict ?? '')
      ? (initial.verdict as PerformanceParams['verdict'])
      : 'ALL',
    linkStatus: ['LINKED', 'UNLINKED'].includes(initial.linkStatus ?? '')
      ? (initial.linkStatus as PerformanceParams['linkStatus'])
      : 'ALL',
    hideNoOrders: false,
    minSpend: '',
    showInactive: false,
    page: 1,
    pageSize: 25,
    sortKey: 'ordersToday',
    sortDirection: 'desc',
  };
}

export function useAdvertisingPerformanceController(initial: PerformanceInitialFilters = {}) {
  const [params, setParams] = useState<PerformanceParams>(() => buildDefaultParams(initial));
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PerformanceRow | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMN_KEYS);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  // Only the newest request may write state; a slower earlier response for a
  // superseded filter must never overwrite fresher data.
  const requestSeq = useRef(0);
  const load = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAdvertisingPerformance(params);
      if (seq === requestSeq.current) setData(result);
    } catch (loadError) {
      if (seq === requestSeq.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load advertising performance.');
      }
    } finally {
      if (!silent && seq === requestSeq.current) setIsLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  // Same-route deep links (e.g. "All ads for this creative") change only the
  // query string; the mounted screen must adopt the new focus filters.
  const focusKey = `${initial.group ?? ''}|${initial.verdict ?? ''}|${initial.linkStatus ?? ''}|${initial.adId ?? ''}|${initial.creativeId ?? ''}|${initial.campaignId ?? ''}`;
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    const next = buildDefaultParams(initial);
    setParams((current) => ({ ...next, startDate: current.startDate, endDate: current.endDate, pageSize: current.pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = searchText.trim();
      setParams((current) => (current.query === query ? current : { ...current, query, page: 1 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  // Column visibility persists locally; stored keys are validated against the
  // registry so stale keys never resurrect ghost columns.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PERFORMANCE_COLUMN_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const known = new Set(PERFORMANCE_COLUMNS.map((column) => column.key));
          const valid = parsed.filter((key): key is string => typeof key === 'string' && known.has(key));
          const locked = PERFORMANCE_COLUMNS.filter((column) => column.locked).map((column) => column.key);
          const merged = [...new Set([...locked, ...valid])];
          if (merged.length > 0) setVisibleColumns(merged);
        }
      }
    } catch { /* keep defaults */ } finally {
      setColumnsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!columnsLoaded || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PERFORMANCE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch { /* best effort */ }
  }, [columnsLoaded, visibleColumns]);

  const updateParams = useCallback((patch: Partial<PerformanceParams>) => {
    setParams((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);

  const toggleColumn = useCallback((key: string) => {
    const column = PERFORMANCE_COLUMNS.find((entry) => entry.key === key);
    if (!column || column.locked) return;
    setVisibleColumns((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  }, []);

  const resetColumns = useCallback(() => setVisibleColumns(DEFAULT_VISIBLE_COLUMN_KEYS), []);

  const runMutation = useCallback(async (operation: () => Promise<unknown>) => {
    setIsMutating(true);
    try {
      await operation();
      await load(true);
    } finally {
      setIsMutating(false);
    }
  }, [load]);

  const link = useCallback((input: { creativeId: string; accountId: string; adId: string }) =>
    runMutation(() => linkMetaAdToCreative(input)), [runMutation]);

  const unlink = useCallback((input: { accountId: string; adId: string }) =>
    runMutation(() => unlinkMetaAd(input)), [runMutation]);

  const transitionPerformance = useCallback((creativeId: string, toStatus: string) =>
    runMutation(() => transitionCreativePerformanceStatus(creativeId, toStatus)), [runMutation]);

  const columns = useMemo(
    () => PERFORMANCE_COLUMNS.filter((column) => column.locked || visibleColumns.includes(column.key)),
    [visibleColumns],
  );

  return {
    params, searchText, data, isLoading, isMutating, error, selected, columns, visibleColumns,
    setSearchText, setSelected, updateParams, toggleColumn, resetColumns,
    link, unlink, transitionPerformance, retry: load,
  };
}
