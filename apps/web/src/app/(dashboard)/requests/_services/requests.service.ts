import apiClient from '@/lib/api-client';
import type {
  CreateWmsPurchasingBatchInput,
  GetWmsPurchasingProductOptionsParams,
  GetWmsPurchasingOverviewParams,
  RespondWmsPurchasingRevisionInput,
  SubmitWmsPurchasingPaymentProofInput,
  WmsPurchasingBatchDetail,
  WmsPurchasingProductOptionsResponse,
  WmsPurchasingOverviewResponse,
} from '../_types/request';

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

export async function fetchWmsPurchasingProductOptions(
  params: GetWmsPurchasingProductOptionsParams = {},
) {
  const response = await apiClient.get('/wms/purchasing/products', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsPurchasingProductOptionsResponse;
}

export async function createWmsPurchasingBatch(
  input: CreateWmsPurchasingBatchInput,
  tenantId?: string,
) {
  const response = await apiClient.post('/wms/purchasing/batches', input, {
    params: tenantId ? { tenantId } : undefined,
  });
  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function submitWmsPurchasingPaymentProof(
  id: string,
  input: SubmitWmsPurchasingPaymentProofInput,
  tenantId?: string,
) {
  const response = await apiClient.post(
    `/wms/purchasing/${id}/payment-proof`,
    input,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function respondWmsPurchasingRevision(
  id: string,
  input: RespondWmsPurchasingRevisionInput,
  tenantId?: string,
) {
  const response = await apiClient.post(
    `/wms/purchasing/${id}/revision-response`,
    input,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}
