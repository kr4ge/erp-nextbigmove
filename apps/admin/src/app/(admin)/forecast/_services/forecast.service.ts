import apiClient from '@/lib/api-client';
import type {
  GetWmsForecastingParams,
  WmsForecastingResponse,
} from '../_types/forecast';

export async function fetchWmsForecasting(params: GetWmsForecastingParams) {
  const response = await apiClient.get('/wms/forecasting', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeIds?.length ? { storeIds: params.storeIds.join(',') } : {}),
      cycleDate: params.cycleDate,
      ...(params.safetyStockPct !== undefined
        ? { safetyStockPct: params.safetyStockPct }
        : {}),
      ...(params.reorderTriggerDays !== undefined
        ? { reorderTriggerDays: params.reorderTriggerDays }
        : {}),
    },
  });

  return response.data as WmsForecastingResponse;
}
