'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCreativeOverview } from '../_services/creative-overview.service';
import type { CreativeOverviewParams, CreativeOverviewResponse } from '../_types/creative-overview';

function ymd(date: Date) { return date.toISOString().slice(0, 10); }
const end = new Date();
const start = new Date();
start.setDate(start.getDate() - 29);

const DEFAULT_PARAMS: CreativeOverviewParams = {
  startDate: ymd(start),
  endDate: ymd(end),
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

export function useCreativeOverviewController() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState<CreativeOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setData(await fetchCreativeOverview(params)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load Creative Agent overview.'); }
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
