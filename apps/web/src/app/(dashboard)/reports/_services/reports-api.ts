import apiClient from '@/lib/api-client';
import type { PosOrdersReportResponse } from '../_types/reports';

export async function fetchPosOrdersReport(
  params: URLSearchParams,
): Promise<PosOrdersReportResponse> {
  const response = await apiClient.get<PosOrdersReportResponse>(
    `/reports/pos-orders-summary?${params.toString()}`,
  );
  return response.data;
}
