import axios from 'axios';
import apiClient from '@/lib/api-client';
import type { PerformanceParams, PerformanceResponse } from '../_types/advertising-performance';

function apiError(error: unknown, fallback: string): Error {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function fetchAdvertisingPerformance(params: PerformanceParams): Promise<PerformanceResponse> {
  try {
    const query = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== false),
    );
    const { data } = await apiClient.get<PerformanceResponse>('/creative-agent/performance', { params: query });
    return data;
  } catch (error) {
    throw apiError(error, 'Unable to load advertising performance.');
  }
}

export async function linkMetaAdToCreative(input: { creativeId: string; accountId: string; adId: string }) {
  try {
    const { data } = await apiClient.post('/creative-agent/unregistered/link', input);
    return data;
  } catch (error) {
    throw apiError(error, 'Unable to link this Meta ad.');
  }
}

export async function unlinkMetaAd(input: { accountId: string; adId: string }) {
  try {
    const { data } = await apiClient.post('/creative-agent/meta-links/unlink', input);
    return data;
  } catch (error) {
    throw apiError(error, 'Unable to unlink this Meta ad.');
  }
}

export async function transitionCreativePerformanceStatus(creativeId: string, toStatus: string) {
  try {
    const { data } = await apiClient.post(`/creative-agent/creatives/${creativeId}/status-transitions`, {
      dimension: 'PERFORMANCE',
      toStatus,
    });
    return data;
  } catch (error) {
    throw apiError(error, 'Unable to update the performance status.');
  }
}
