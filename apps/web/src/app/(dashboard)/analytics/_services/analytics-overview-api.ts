import apiClient from '@/lib/api-client';

type QueryParams = Record<string, string | string[]>;

export const analyticsOverviewApi = {
  getMarketingOverview<T>(query: URLSearchParams, signal?: AbortSignal) {
    return apiClient.get<T>(`/analytics/marketing/overview?${query.toString()}`, { signal });
  },

  getSalesOverview<T>(query: URLSearchParams, signal?: AbortSignal) {
    return apiClient.get<T>(`/analytics/sales/overview?${query.toString()}`, { signal });
  },

  getSalesStoreBreakdown<T>(query: URLSearchParams, signal?: AbortSignal) {
    return apiClient.get<T>(`/analytics/sales/store-breakdown?${query.toString()}`, { signal });
  },

  getSalesByTeamOverview<T>(query: URLSearchParams, signal?: AbortSignal) {
    return apiClient.get<T>(`/analytics/sales-by-team/overview?${query.toString()}`, { signal });
  },

  getSalesPerformanceOverview<T>(params: QueryParams, signal?: AbortSignal) {
    return apiClient.get<T>('/analytics/sales-performance/overview', { params, signal });
  },

  getSalesPerformanceStoreConversion<T>(params: QueryParams, signal?: AbortSignal) {
    return apiClient.get<T>('/analytics/sales-performance/store-conversion', { params, signal });
  },

  getProblematicDelivery<T>(params: QueryParams, signal?: AbortSignal) {
    return apiClient.get<T>('/analytics/sales-performance/problematic-delivery', {
      params,
      signal,
    });
  },
};
