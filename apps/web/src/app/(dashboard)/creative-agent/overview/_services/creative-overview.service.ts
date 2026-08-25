import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { CreativeOverviewParams, CreativeOverviewResponse } from '../_types/creative-overview';

export async function fetchCreativeOverview(params: CreativeOverviewParams): Promise<CreativeOverviewResponse> {
  try {
    const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ''));
    return (await apiClient.get<CreativeOverviewResponse>('/creative-agent/overview', { params: query })).data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message;
      throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Unable to load Creative Agent overview.');
    }
    throw error instanceof Error ? error : new Error('Unable to load Creative Agent overview.');
  }
}
