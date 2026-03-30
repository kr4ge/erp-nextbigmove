import apiClient from '@/lib/api-client';
import type { MetaAdAccount, MetaAdInsight, MetaIntegration } from '../types';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function toDateParam(value: string | Date | null) {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

export const metaDetailService = {
  async fetchIntegration(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');
    const response = await apiClient.get<MetaIntegration>(`/integrations/${integrationId}`, {
      headers,
    });
    return response.data;
  },

  async fetchAdAccounts(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');
    const response = await apiClient.get<MetaAdAccount[]>(
      `/integrations/${integrationId}/meta/accounts`,
      { headers },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async syncAccounts(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');
    const response = await apiClient.post(
      `/integrations/${integrationId}/meta/sync-accounts`,
      {},
      { headers },
    );
    return response.data as { success?: boolean; message?: string };
  },

  async testConnection(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');
    const response = await apiClient.post(
      `/integrations/${integrationId}/test-connection`,
      {},
      { headers },
    );
    return response.data as { success?: boolean; data?: unknown };
  },

  async updateAccountMultiplier(params: {
    integrationId: string;
    accountIds: string[];
    multiplier: number;
  }) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');
    await apiClient.patch(
      `/integrations/${params.integrationId}/meta/accounts/multiplier`,
      {
        accountIds: params.accountIds,
        multiplier: params.multiplier,
      },
      { headers },
    );
  },

  async fetchInsights(params: {
    integrationId: string;
    accountId?: string;
    startDate: string | Date | null;
    endDate: string | Date | null;
  }) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const query: Record<string, string> = {};
    if (params.accountId && params.accountId !== 'all') {
      query.accountId = params.accountId;
    }
    const start = toDateParam(params.startDate);
    if (start) query.dateFrom = start;
    const end = toDateParam(params.endDate);
    if (end) query.dateTo = end;

    const response = await apiClient.get<MetaAdInsight[]>(
      `/integrations/${params.integrationId}/meta/insights`,
      { headers, params: query },
    );
    return Array.isArray(response.data) ? response.data : [];
  },
};
