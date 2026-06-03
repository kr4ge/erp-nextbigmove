'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWmsPurchasingUnreadNotificationCount } from '../_services/purchasing.service';
import { usePurchasingRealtime } from './use-purchasing-realtime';

const WMS_PURCHASING_NOTIFICATION_QUERY_KEY = ['wms-purchasing-notification-count'];

export function usePurchasingNotificationCount(enabled: boolean, tenantId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...WMS_PURCHASING_NOTIFICATION_QUERY_KEY, tenantId ?? 'default-tenant'],
    queryFn: async () => {
      const response = await fetchWmsPurchasingUnreadNotificationCount(tenantId ?? undefined);
      return response.count;
    },
    enabled,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: WMS_PURCHASING_NOTIFICATION_QUERY_KEY });
  }, [queryClient]);

  usePurchasingRealtime({
    enabled,
    tenantId,
    onUpdate: refresh,
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
  };
}
