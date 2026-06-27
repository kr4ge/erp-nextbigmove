import apiClient from '@/lib/api-client';
import type {
  AgingOrdersSummaryResponse,
  AgingOrdersSummaryUnreadNotificationCountResponse,
  OrderStatusSummaryResponse,
} from '../_types/summary';

export async function fetchAgingOrdersSummary(thresholdDays = 2): Promise<AgingOrdersSummaryResponse> {
  const response = await apiClient.get<AgingOrdersSummaryResponse>('/orders/summary/aging', {
    params: {
      threshold_days: thresholdDays,
    },
  });
  return response.data;
}

export async function fetchAgingOrdersSummaryUnreadNotificationCount() {
  const response = await apiClient.get<AgingOrdersSummaryUnreadNotificationCountResponse>(
    '/orders/summary/aging/notifications/unread-count',
  );
  return response.data;
}

export async function markAgingOrdersSummaryNotificationRead(shopId: string) {
  const response = await apiClient.post<{ success: boolean; count: number }>(
    '/orders/summary/aging/notifications/read',
    {
      shop_id: shopId,
    },
  );
  return response.data;
}

export async function fetchOrderStatusSummary(params: {
  dateLocal: string;
  shopIds?: string[];
}) {
  const response = await apiClient.get<OrderStatusSummaryResponse>('/orders/summary/status', {
    params: {
      date_local: params.dateLocal,
      ...(params.shopIds && params.shopIds.length > 0 ? { shop_id: params.shopIds } : {}),
    },
  });
  return response.data;
}
