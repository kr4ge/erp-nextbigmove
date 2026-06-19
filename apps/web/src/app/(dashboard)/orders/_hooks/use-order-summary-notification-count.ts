'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAgingOrdersSummaryUnreadNotificationCount } from '../_services/summary-api';
import { useOrderSummaryRealtime } from './use-order-summary-realtime';

export const ORDER_SUMMARY_NOTIFICATION_COUNT_QUERY_KEY = [
  'erp-order-summary-aging-notification-count',
];

export function useOrderSummaryNotificationCount(
  enabled: boolean,
  tenantId?: string | null,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...ORDER_SUMMARY_NOTIFICATION_COUNT_QUERY_KEY, tenantId ?? 'default-tenant'],
    queryFn: async () => {
      const response = await fetchAgingOrdersSummaryUnreadNotificationCount();
      return response.count;
    },
    enabled,
    staleTime: 60_000,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ORDER_SUMMARY_NOTIFICATION_COUNT_QUERY_KEY,
    });
  }, [queryClient]);

  useOrderSummaryRealtime({
    enabled,
    tenantId,
    onUpdate: refresh,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleTeamScopeChanged = () => {
      refresh();
    };

    window.addEventListener('teamScopeChanged', handleTeamScopeChanged as EventListener);
    return () => {
      window.removeEventListener('teamScopeChanged', handleTeamScopeChanged as EventListener);
    };
  }, [refresh]);

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
