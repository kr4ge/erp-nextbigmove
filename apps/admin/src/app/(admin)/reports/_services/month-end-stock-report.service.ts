import apiClient from '@/lib/api-client';
import type { MonthEndStockReportResponse } from '../_types/month-end-stock-report';

export async function fetchMonthEndStockReport(params: {
  tenantIds: string[];
  storeIds: string[];
}) {
  const response = await apiClient.get('/wms/reports/month-end-stock', {
    params: {
      ...(params.tenantIds.length ? { tenantIds: params.tenantIds.join(',') } : {}),
      ...(params.storeIds.length ? { storeIds: params.storeIds.join(',') } : {}),
    },
  });

  return response.data as MonthEndStockReportResponse;
}
