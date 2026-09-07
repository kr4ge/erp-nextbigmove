import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { AdvertisingDashboardResponse, DashboardParams } from '../_types/advertising-dashboard';

export async function fetchAdvertisingDashboard(params: DashboardParams): Promise<AdvertisingDashboardResponse> {
  try {
    const { storeIds, creatorIds, ...rest } = params;
    const query: Record<string, string> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== ''),
    ) as Record<string, string>;
    if (storeIds.length) query.storeIds = storeIds.join(',');
    if (creatorIds.length) query.creatorIds = creatorIds.join(',');
    const { data } = await apiClient.get<AdvertisingDashboardResponse>('/creative-agent/advertising/dashboard', { params: query });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Unable to load the advertising dashboard.');
    }
    throw error instanceof Error ? error : new Error('Unable to load the advertising dashboard.');
  }
}
