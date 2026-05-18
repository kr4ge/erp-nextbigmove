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

const STOCK_REQUESTS_API_PATH = '/stock-requests';

export async function fetchWmsPurchasingOverview(params: GetWmsPurchasingOverviewParams = {}) {
  const response = await apiClient.get(`${STOCK_REQUESTS_API_PATH}/overview`, {
    params: {
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

export async function fetchWmsPurchasingBatch(id: string) {
  const response = await apiClient.get(`${STOCK_REQUESTS_API_PATH}/${id}`);
  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function fetchWmsPurchasingProductOptions(
  params: GetWmsPurchasingProductOptionsParams = {},
) {
  const response = await apiClient.get(`${STOCK_REQUESTS_API_PATH}/products`, {
    params: {
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsPurchasingProductOptionsResponse;
}

export async function createWmsPurchasingBatch(input: CreateWmsPurchasingBatchInput) {
  const response = await apiClient.post(`${STOCK_REQUESTS_API_PATH}/batches`, input);
  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function submitWmsPurchasingPaymentProof(
  id: string,
  input: SubmitWmsPurchasingPaymentProofInput,
) {
  const response = await apiClient.post(
    `${STOCK_REQUESTS_API_PATH}/${id}/payment-proof`,
    input,
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}

export async function respondWmsPurchasingRevision(
  id: string,
  input: RespondWmsPurchasingRevisionInput,
) {
  const response = await apiClient.post(
    `${STOCK_REQUESTS_API_PATH}/${id}/revision-response`,
    input,
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}
