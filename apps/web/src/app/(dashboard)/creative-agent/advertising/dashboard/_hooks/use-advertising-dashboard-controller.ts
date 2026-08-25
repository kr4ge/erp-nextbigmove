'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { manilaDaysAgo, manilaToday } from '../../_utils/manila-date';
import { fetchAdvertisingDashboard } from '../_services/advertising-dashboard.service';
import type { AdvertisingDashboardResponse, DashboardParams } from '../_types/advertising-dashboard';

function buildDefaultParams(): DashboardParams {
  return { startDate: manilaDaysAgo(29), endDate: manilaToday(), storeId: '', accountId: '', creatorId: '' };
}

export function useAdvertisingDashboardController() {
  const [params, setParams] = useState<DashboardParams>(buildDefaultParams);
  const [data, setData] = useState<AdvertisingDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAdvertisingDashboard(params);
      if (seq === requestSeq.current) setData(result);
    } catch (loadError) {
      if (seq === requestSeq.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the advertising dashboard.');
      }
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const updateParams = useCallback((patch: Partial<DashboardParams>) => {
    setParams((current) => ({ ...current, ...patch }));
  }, []);

  return { params, data, isLoading, error, updateParams, retry: load };
}
