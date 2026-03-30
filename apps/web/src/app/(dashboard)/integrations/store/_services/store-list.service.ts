import apiClient from '@/lib/api-client';
import { getSelectedTeamIdsFromStorage } from '../../_utils/team-scope';
import type { StoreCard } from '../_types/store-list';

function getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const teamIds = getSelectedTeamIdsFromStorage();
  if (teamIds.length > 0) {
    headers['X-Team-Id'] = teamIds.join(',');
  }
  return headers;
}

export const storeListService = {
  async fetchStores() {
    const headers = getAuthHeaders();
    if (!headers) {
      throw new Error('Unauthorized');
    }

    const response = await apiClient.get('/integrations/pos-stores', { headers });
    const payload = response.data;
    if (Array.isArray(payload)) return payload as StoreCard[];
    if (Array.isArray(payload?.data)) return payload.data as StoreCard[];
    return [];
  },
};
