import apiClient from '@/lib/api-client';

type QueryParams = Record<string, string | string[]>;

export const analyticsOverviewApi = {
  getMarketingOverview<T>(query: URLSearchParams) {
    return apiClient.get<T>(`/analytics/marketing/overview?${query.toString()}`);
  },

  getSalesOverview<T>(query: URLSearchParams) {
    return apiClient.get<T>(`/analytics/sales/overview?${query.toString()}`);
  },

  getSalesPerformanceOverview<T>(params: QueryParams) {
    return apiClient.get<T>('/analytics/sales-performance/overview', { params });
  },

  getProblematicDelivery<T>(params: QueryParams) {
    return apiClient.get<T>('/analytics/sales-performance/problematic-delivery', {
      params,
    });
  },
};
