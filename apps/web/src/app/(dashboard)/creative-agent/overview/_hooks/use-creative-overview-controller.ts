'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCreativeOverview } from '../_services/creative-overview.service';
import { manilaToday } from '../../advertising/_utils/manila-date';
import type { CreativeOverviewParams, CreativeOverviewResponse } from '../_types/creative-overview';

/**
 * Today, in Manila, on both ends — the dashboard opens on the day you are
 * having, which is the only window where "Daily Ads Spend" reads as itself
 * rather than as a period average.
 *
 * Built per mount rather than at module scope: a module-level "today" is
 * captured when the bundle loads and then never moves, so a tab left open
 * overnight would keep reporting yesterday. Manila rather than UTC because the
 * API keys its days to Manila, and a UTC date would blank the dashboard every
 * Manila morning before 08:00.
 */
function defaultParams(): CreativeOverviewParams {
  const today = manilaToday();
  return {
    startDate: today,
    endDate: today,
    query: '',
    storeId: '',
    kind: '',
    creatorId: '',
    lens: 'CREATIVE',
    page: 1,
    pageSize: 10,
    sortKey: 'creativeScore',
    sortDirection: 'desc',
  };
}

export function useCreativeOverviewController() {
  const [params, setParams] = useState<CreativeOverviewParams>(defaultParams);
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState<CreativeOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setData(await fetchCreativeOverview(params)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load the creative dashboard.'); }
    finally { setIsLoading(false); }
  }, [params]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = searchText.trim();
      setParams((current) => current.query === query ? current : { ...current, query, page: 1 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const updateParams = useCallback((patch: Partial<CreativeOverviewParams>) => {
    setParams((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);

  return { params, searchText, data, isLoading, error, setSearchText, updateParams, retry: load };
}
