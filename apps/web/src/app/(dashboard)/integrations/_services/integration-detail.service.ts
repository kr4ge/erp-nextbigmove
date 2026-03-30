import apiClient from '@/lib/api-client';
import type { Integration } from '../types';
import type { AdAccountOption, ShopOption } from '../_types/integration-detail';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export const integrationDetailService = {
  async fetchIntegration(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get<Integration>(`/integrations/${integrationId}`, {
      headers,
    });
    return response.data;
  },

  async testConnection(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.post(
      `/integrations/${integrationId}/test-connection`,
      {},
      { headers },
    );
    return response.data as {
      success?: boolean;
      message?: string;
      details?: {
        shops?: ShopOption[];
      };
    };
  },

  async createTemporaryPosIntegration(apiKey: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    const response = await apiClient.post(
      '/integrations',
      {
        name: 'temp-test',
        provider: 'PANCAKE_POS',
        credentials: { apiKey },
        config: {},
      },
      { headers },
    );
    return response.data as { id: string };
  },

  async deleteIntegration(integrationId: string) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    await apiClient.delete(`/integrations/${integrationId}`, { headers });
  },

  async fetchMetaAdAccounts(accessToken: string) {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`,
    );
    const data = (await response.json()) as { data?: AdAccountOption[] };
    return Array.isArray(data.data) ? data.data : [];
  },

  async updateIntegration(integrationId: string, payload: Record<string, unknown>) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');

    await apiClient.patch(`/integrations/${integrationId}`, payload, { headers });
  },

  async toggleIntegration(integrationId: string, enabled: boolean) {
    const headers = getAuthHeaders();
    if (!headers) throw new Error('UNAUTHORIZED');
    const endpoint = enabled ? 'disable' : 'enable';

    await apiClient.post(`/integrations/${integrationId}/${endpoint}`, {}, { headers });
  },
};
