import apiClient from '@/lib/api-client';
import type {
  GetWmsPurchasingOverviewParams,
  UpdateWmsPurchasingLineInput,
  UpdateWmsPurchasingStatusInput,
  WmsPurchasingBatchDetail,
  WmsPurchasingOverviewResponse,
} from '../_types/purchasing';

export async function fetchWmsPurchasingOverview(params: GetWmsPurchasingOverviewParams = {}) {
  const response = await apiClient.get('/wms/purchasing/overview', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.requestType ? { requestType: params.requestType } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsPurchasingOverviewResponse;
}

export async function fetchWmsPurchasingBatch(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/purchasing/${id}`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function updateWmsPurchasingStatus(
  id: string,
  input: UpdateWmsPurchasingStatusInput,
  tenantId?: string,
) {
  const response = await apiClient.patch(
    `/wms/purchasing/${id}/status`,
    input,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function updateWmsPurchasingLine(
  batchId: string,
  lineId: string,
  input: UpdateWmsPurchasingLineInput,
  tenantId?: string,
) {
  const response = await apiClient.patch(
    `/wms/purchasing/${batchId}/lines/${lineId}`,
    input,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}
