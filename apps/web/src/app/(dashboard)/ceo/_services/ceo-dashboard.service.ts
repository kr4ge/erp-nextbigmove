import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { CeoDashboardParams, CeoDashboardResponse } from '../_types/ceo-dashboard';

export async function fetchCeoDashboard(params: CeoDashboardParams): Promise<CeoDashboardResponse> {
  try {
    // shopIds travels as a comma-separated list; an empty selection is omitted
    // entirely so the API reads it as "every store in range".
    const { shopIds, ...rest } = params;
    const query: Record<string, string> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== ''),
    ) as Record<string, string>;
    if (shopIds.length) query.shopIds = shopIds.join(',');
    const { data } = await apiClient.get<CeoDashboardResponse>('/analytics/ceo/dashboard', { params: query });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Unable to load the dashboard.');
    }
    throw error instanceof Error ? error : new Error('Unable to load the dashboard.');
  }
}
