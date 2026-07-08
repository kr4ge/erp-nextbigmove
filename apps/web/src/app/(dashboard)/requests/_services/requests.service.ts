import apiClient from '@/lib/api-client';
import type {
  CreateWmsPurchasingBatchInput,
  GetWmsPurchasingProductOptionsParams,
  GetWmsPurchasingOverviewParams,
  MarkWmsSelfBuyShipmentInput,
  RespondWmsPurchasingRevisionInput,
  SubmitWmsPurchasingPaymentProofInput,
  UploadedWmsPurchasingProofImage,
  WmsPurchasingBatchDetail,
  WmsInvoiceDetail,
  WmsInvoiceDocumentResponse,
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

export async function fetchWmsPurchasingLinkedInvoice(id: string) {
  const response = await apiClient.get(`${STOCK_REQUESTS_API_PATH}/${id}/invoice`);
  return response.data as { invoice: WmsInvoiceDetail };
}

export async function fetchWmsPurchasingLinkedInvoiceDocument(id: string) {
  const response = await apiClient.get(`${STOCK_REQUESTS_API_PATH}/${id}/invoice/document`);
  return response.data as WmsInvoiceDocumentResponse;
}

export async function fetchStockRequestUnreadNotificationCount() {
  const response = await apiClient.get(`${STOCK_REQUESTS_API_PATH}/notifications/unread-count`);
  return response.data as { count: number };
}

export async function markStockRequestNotificationsRead(id: string) {
  const response = await apiClient.post(`${STOCK_REQUESTS_API_PATH}/${id}/notifications/read`);
  return response.data as { success: boolean };
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

export async function uploadWmsPurchasingPaymentProofImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post(
    `${STOCK_REQUESTS_API_PATH}/payment-proof-upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return response.data as { asset: UploadedWmsPurchasingProofImage };
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

export async function markWmsSelfBuyShipment(
  id: string,
  input: MarkWmsSelfBuyShipmentInput,
) {
  const response = await apiClient.post(
    `${STOCK_REQUESTS_API_PATH}/${id}/self-buy/shipped`,
    input,
  );

  return response.data as { batch: WmsPurchasingBatchDetail };
}
