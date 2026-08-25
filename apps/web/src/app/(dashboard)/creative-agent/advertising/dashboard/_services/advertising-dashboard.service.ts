import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { AdvertisingDashboardResponse, DashboardParams } from '../_types/advertising-dashboard';

export async function fetchAdvertisingDashboard(params: DashboardParams): Promise<AdvertisingDashboardResponse> {
  try {
    const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ''));
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
