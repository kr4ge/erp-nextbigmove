'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStockRequestUnreadNotificationCount } from '../_services/requests.service';
import { useStockRequestRealtime } from './use-stock-request-realtime';

const REQUEST_NOTIFICATION_COUNT_QUERY_KEY = ['erp-stock-request-notification-count'];

export function useRequestNotificationCount(enabled: boolean, tenantId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...REQUEST_NOTIFICATION_COUNT_QUERY_KEY, tenantId ?? 'default-tenant'],
    queryFn: async () => {
      const response = await fetchStockRequestUnreadNotificationCount();
      return response.count;
    },
    enabled,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: REQUEST_NOTIFICATION_COUNT_QUERY_KEY });
  }, [queryClient]);

  useStockRequestRealtime({
    enabled,
    tenantId,
    onUpdate: refresh,
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
