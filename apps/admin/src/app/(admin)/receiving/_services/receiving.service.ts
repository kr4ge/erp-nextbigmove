import apiClient from '@/lib/api-client';
import type {
  AssignWmsReceivingPutawayInput,
  CreateWmsReceivingBatchInput,
  GetWmsReceivingOverviewParams,
  WmsReceivingBatchDetail,
  WmsReceivingPutawayOptionsResponse,
  WmsReceivingOverviewResponse,
} from '../_types/receiving';

export async function fetchWmsReceivingOverview(params: GetWmsReceivingOverviewParams = {}) {
  const response = await apiClient.get('/wms/receiving/overview', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });

  return response.data as WmsReceivingOverviewResponse;
}

export async function createWmsReceivingBatch(
  input: CreateWmsReceivingBatchInput,
  tenantId?: string,
) {
  const response = await apiClient.post('/wms/receiving/batches', input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { batch: WmsReceivingBatchDetail };
}

export async function fetchWmsReceivingBatch(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/receiving/${id}`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { batch: WmsReceivingBatchDetail };
}

export async function recordWmsReceivingBatchLabelPrint(
  id: string,
  input: { action: 'PRINT' | 'REPRINT' },
  tenantId?: string,
) {
  const response = await apiClient.post(`/wms/receiving/${id}/labels/print`, input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    print: {
      action: 'PRINT' | 'REPRINT';
      itemCount: number;
    };
    batch: {
      id: string;
      code: string;
      labelPrintCount: number;
      firstLabelPrintedAt: string | null;
      lastLabelPrintedAt: string | null;
    };
  };
}

export async function fetchWmsReceivingPutawayOptions(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/receiving/${id}/putaway/options`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as WmsReceivingPutawayOptionsResponse;
}

export async function assignWmsReceivingPutaway(
  id: string,
  input: AssignWmsReceivingPutawayInput,
  tenantId?: string,
) {
  const response = await apiClient.post(`/wms/receiving/${id}/putaway/assign`, input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as {
    updatedUnitCount: number;
    batch: {
      id: string;
      code: string;
      status: string;
      completedAt: string | null;
      updatedAt: string;
      totalUnits: number;
      putAwayUnits: number;
    };
  };
}
