import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { CeoDashboardParams, CeoDashboardResponse } from '../_types/ceo-dashboard';

export async function fetchCeoDashboard(params: CeoDashboardParams): Promise<CeoDashboardResponse> {
  try {
    const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ''));
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
