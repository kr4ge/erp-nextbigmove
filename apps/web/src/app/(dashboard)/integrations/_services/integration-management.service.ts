import apiClient from '@/lib/api-client';
import type { Integration } from '../types';
import type { PosShopOption } from '../_types/integration-management';
import { getSelectedTeamIdsFromStorage } from '../_utils/team-scope';

function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function buildScopedHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const scopeIds = getSelectedTeamIdsFromStorage();
  if (scopeIds.length > 0) {
    headers['X-Team-Id'] = scopeIds.join(',');
  }
  return headers;
}

function parseListPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

export const integrationManagementService = {
  getAccessToken,

  async fetchIntegrations() {
    const token = getAccessToken();
    if (!token) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get('/integrations', {
      headers: buildScopedHeaders(token),
    });
    return parseListPayload<Integration>(response.data);
  },

  async fetchPosStores() {
    const token = getAccessToken();
    if (!token) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get('/integrations/pos-stores', {
      headers: buildScopedHeaders(token),
    });
    return parseListPayload<Record<string, unknown>>(response.data);
  },

  async createIntegration(payload: Record<string, unknown>) {
    const token = getAccessToken();
    if (!token) throw new Error('UNAUTHORIZED');

    await apiClient.post('/integrations', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async updateIntegration(id: string, payload: Record<string, unknown>) {
    const token = getAccessToken();
    if (!token) throw new Error('UNAUTHORIZED');

    await apiClient.patch(`/integrations/${id}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async deleteIntegration(id: string) {
    const token = getAccessToken();
    if (!token) throw new Error('UNAUTHORIZED');

    await apiClient.delete(`/integrations/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async checkPosStoreDuplicate(apiKey: string) {
    const token = getAccessToken();
    if (!token) throw new Error('UNAUTHORIZED');

    const response = await apiClient.get('/integrations/pos-stores/check', {
      params: { apiKey },
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data as { duplicate?: boolean; reason?: string };
  },

  async fetchPancakeShops(apiKey: string) {
    const response = await fetch(`https://pos.pages.fm/api/v1/shops?api_key=${apiKey}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to fetch shops');
    }
    const payload = (await response.json()) as { shops?: PosShopOption[] };
    return Array.isArray(payload?.shops) ? payload.shops : [];
  },
};
