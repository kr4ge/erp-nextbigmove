import apiClient from '@/lib/api-client';
import type { WebhookConfig, WebhookLogsFilters, WebhookLogsResponse } from '../_types/webhook';

type WebhookUpdatePayload = {
  enabled?: boolean;
  reconcileEnabled?: boolean;
  autoCancelEnabled?: boolean;
  reconcileIntervalSeconds?: number;
  reconcileMode?: 'incremental' | 'full_reset';
};

type RelayUpdatePayload = {
  enabled: boolean;
  webhookUrl: string;
  headerKey: string;
  apiKey?: string;
};

export const webhookService = {
  async fetchPermissions() {
    const res = await apiClient.get('/auth/permissions');
    return Array.isArray(res?.data?.permissions) ? (res.data.permissions as string[]) : [];
  },

  async fetchConfig() {
    const res = await apiClient.get<WebhookConfig>('/integrations/pancake/webhook');
    return res.data;
  },

  async fetchLogs(
    filters: WebhookLogsFilters,
    page: number,
    limit: number,
  ) {
    const params: Record<string, string | number> = {
      page,
      limit,
    };

    if (filters.receiveStatus) params.receive_status = filters.receiveStatus;
    if (filters.processStatus) params.process_status = filters.processStatus;
    if (filters.relayStatus) params.relay_status = filters.relayStatus;
    if (filters.shopId.trim()) params.shop_id = filters.shopId.trim();
    if (filters.orderId.trim()) params.order_id = filters.orderId.trim();
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.startDate) params.start_date = filters.startDate;
    if (filters.endDate) params.end_date = filters.endDate;

    const res = await apiClient.get<WebhookLogsResponse>('/integrations/pancake/webhook/logs', {
      params,
    });
    return res.data;
  },

  async rotateKey() {
    const res = await apiClient.post('/integrations/pancake/webhook/rotate-key');
    return res.data as Partial<WebhookConfig> & {
      apiKey?: string;
      keyLast4?: string | null;
      rotatedAt?: string | null;
      rotatedByUserId?: string | null;
    };
  },

  async updateWebhook(payload: WebhookUpdatePayload) {
    const res = await apiClient.patch<WebhookConfig>('/integrations/pancake/webhook', payload);
    return res.data;
  },

  async updateRelay(payload: RelayUpdatePayload) {
    const res = await apiClient.patch<WebhookConfig>('/integrations/pancake/webhook/relay', payload);
    return res.data;
  },
};

