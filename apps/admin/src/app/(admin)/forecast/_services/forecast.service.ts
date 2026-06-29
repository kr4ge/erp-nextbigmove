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
      ...(params.pastSalesWindowDays !== undefined
        ? { pastSalesWindowDays: params.pastSalesWindowDays }
        : {}),
    },
  });

  return response.data as WmsForecastingResponse;
}

export async function generateWmsForecasting(params: GetWmsForecastingParams) {
  const response = await apiClient.post('/wms/forecasting/generate', {
    ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    storeIds: params.storeIds ?? [],
    cycleDate: params.cycleDate,
    ...(params.safetyStockPct !== undefined
      ? { safetyStockPct: params.safetyStockPct }
      : {}),
    ...(params.reorderTriggerDays !== undefined
      ? { reorderTriggerDays: params.reorderTriggerDays }
      : {}),
    ...(params.pastSalesWindowDays !== undefined
      ? { pastSalesWindowDays: params.pastSalesWindowDays }
      : {}),
  });

  return response.data as WmsForecastingResponse;
}
