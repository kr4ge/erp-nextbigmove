import apiClient from '@/lib/api-client';
import type {
  CreateWmsInvoiceInput,
  GetWmsInvoiceOverviewParams,
  UpdateWmsInvoiceInput,
  UpdateWmsInvoiceStatusInput,
  WmsInvoiceDetail,
  WmsInvoiceDocumentResponse,
  WmsInvoiceOverviewResponse,
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

export async function fetchWmsInvoiceOverview(params: GetWmsInvoiceOverviewParams = {}) {
  const response = await apiClient.get('/wms/purchasing/invoices/overview', {
    params: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.sourceType ? { sourceType: params.sourceType } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsInvoiceOverviewResponse;
}

export async function fetchWmsInvoiceDetail(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/purchasing/invoices/${id}`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { invoice: WmsInvoiceDetail };
}

export async function fetchWmsInvoiceDocument(id: string, tenantId?: string) {
  const response = await apiClient.get(`/wms/purchasing/invoices/${id}/document`, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as WmsInvoiceDocumentResponse;
}

export async function createManualWmsInvoice(input: CreateWmsInvoiceInput, tenantId?: string) {
  const response = await apiClient.post('/wms/purchasing/invoices/manual', input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { invoice: WmsInvoiceDetail };
}

export async function updateWmsInvoice(id: string, input: UpdateWmsInvoiceInput, tenantId?: string) {
  const response = await apiClient.patch(`/wms/purchasing/invoices/${id}`, input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { invoice: WmsInvoiceDetail };
}

export async function updateWmsInvoiceStatus(
  id: string,
  input: UpdateWmsInvoiceStatusInput,
  tenantId?: string,
) {
  const response = await apiClient.patch(`/wms/purchasing/invoices/${id}/status`, input, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { invoice: WmsInvoiceDetail };
}

export async function ensureProcurementLinkedInvoice(id: string, tenantId?: string) {
  const response = await apiClient.post(`/wms/purchasing/${id}/invoice/ensure`, undefined, {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { invoice: WmsInvoiceDetail };
}

export async function ensureManualReceivingLinkedInvoice(receivingBatchId: string, tenantId?: string) {
  const response = await apiClient.post(
    `/wms/purchasing/invoices/manual-receiving/${receivingBatchId}/ensure`,
    undefined,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as { invoice: WmsInvoiceDetail };
}

export async function fetchWmsPurchasingUnreadNotificationCount(tenantId?: string) {
  const response = await apiClient.get('/wms/purchasing/notifications/unread-count', {
    params: tenantId ? { tenantId } : undefined,
  });

  return response.data as { count: number };
}

export async function markWmsPurchasingNotificationsRead(id: string, tenantId?: string) {
  const response = await apiClient.post(
    `/wms/purchasing/${id}/notifications/read`,
    undefined,
    {
      params: tenantId ? { tenantId } : undefined,
    },
  );

  return response.data as { success: boolean };
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
