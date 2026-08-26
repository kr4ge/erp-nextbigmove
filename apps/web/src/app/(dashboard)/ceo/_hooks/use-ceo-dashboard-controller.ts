'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { manilaToday } from '../../creative-agent/advertising/_utils/manila-date';
import { fetchCeoDashboard } from '../_services/ceo-dashboard.service';
import type { CeoDashboardParams, CeoDashboardResponse } from '../_types/ceo-dashboard';

/** Month to date, in the tenant's timezone — the reference's default lens. */
function buildDefaultParams(): CeoDashboardParams {
  const today = manilaToday();
  return { startDate: `${today.slice(0, 7)}-01`, endDate: today, accountId: '' };
}

export function useCeoDashboardController() {
  const [params, setParams] = useState<CeoDashboardParams>(buildDefaultParams);
  const [data, setData] = useState<CeoDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may write state.
  const requestSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchCeoDashboard(params);
      if (seq === requestSeq.current) setData(result);
    } catch (loadError) {
      if (seq === requestSeq.current) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the dashboard.');
      }
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const updateParams = useCallback((patch: Partial<CeoDashboardParams>) => {
    setParams((current) => ({ ...current, ...patch }));
  }, []);

  return { params, data, isLoading, error, updateParams, retry: load };
}
