import apiClient from '@/lib/api-client';
import { getSelectedTeamIdsFromStorage } from '../../_utils/team-scope';
import type { MetaIntegration } from '../_types/meta-integration';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const scopeIds = getSelectedTeamIdsFromStorage();
  if (scopeIds.length > 0) {
    headers['X-Team-Id'] = scopeIds.join(',');
  }
  return headers;
}

function toList(payload: unknown): MetaIntegration[] {
  if (Array.isArray(payload)) return payload as MetaIntegration[];
  const record = payload as { data?: unknown };
  if (Array.isArray(record?.data)) return record.data as MetaIntegration[];
  return [];
}

export const metaIntegrationsService = {
  async fetchAll() {
    const headers = getAuthHeaders();
    if (!headers) {
      throw new Error('UNAUTHORIZED');
    }

    const response = await apiClient.get('/integrations', { headers });
    const list = toList(response.data);
    return list.filter((item) => item.provider === 'META_ADS');
  },

  async remove(id: string) {
    const headers = getAuthHeaders();
    if (!headers) {
      throw new Error('UNAUTHORIZED');
    }

    await apiClient.delete(`/integrations/${id}`, { headers });
  },
};
