import apiClient from "@/lib/api-client";
import type {
  AuditWmsStockRequestInput,
  CreateWmsStockRequestInput,
  CreateWmsStockRequestPaymentInput,
  ListWmsForecastsParams,
  ListWmsInvoicesParams,
  ListWmsPaymentsParams,
  ListWmsRequestProductsParams,
  ListWmsStockRequestsParams,
  RespondWmsStockRequestInput,
  ReviewWmsStockRequestInput,
  UpsertWmsCompanyBillingSettingsInput,
  VerifyWmsStockRequestPaymentInput,
  WmsCompanyBillingSettings,
  WmsForecastRow,
  WmsInvoiceListItem,
  WmsPartnerType,
  WmsRequestProduct,
  WmsStockRequest,
  WmsStockRequestPayment,
} from "../_types/requests";

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string | string[] } } }
    ).response;
    const message = response?.data?.message;
    if (typeof message === "string") {
      return message;
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.join(", ");
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function fetchWmsPartnerTypes() {
  const response = await apiClient.get<WmsPartnerType[]>("/wms/partner-types");
  return response.data;
}

export async function fetchWmsCompanyBillingSettings() {
  const response = await apiClient.get<WmsCompanyBillingSettings | null>(
    "/wms/company-settings/billing",
  );
  return response.data;
}

export async function upsertWmsCompanyBillingSettings(
  payload: UpsertWmsCompanyBillingSettingsInput,
) {
  try {
    const response = await apiClient.put<WmsCompanyBillingSettings>(
      "/wms/company-settings/billing",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to save WMS billing settings."),
    );
  }
}

export async function fetchWmsRequestProducts(
  params?: ListWmsRequestProductsParams,
) {
  try {
    const response = await apiClient.get<WmsRequestProduct[]>(
      "/wms/request-products",
      {
        params: {
          tenantId: params?.tenantId || undefined,
          storeId: params?.storeId || undefined,
          search: params?.search || undefined,
          requestableOnly: params?.requestableOnly,
          profileOnly: params?.profileOnly,
          limit: params?.limit,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to load request products."),
    );
  }
}

export async function fetchWmsForecasts(params: ListWmsForecastsParams) {
  const response = await apiClient.get<WmsForecastRow[]>("/wms/forecasts", {
    params: {
      tenantId: params.tenantId,
      storeId: params.storeId || undefined,
      search: params.search || undefined,
      requestType: params.requestType || undefined,
      runDate: params.runDate || undefined,
      requestableOnly: params.requestableOnly,
      profileOnly: params.profileOnly,
      limit: params.limit,
    },
  });
  return response.data;
}

export async function fetchWmsStockRequests(
  params?: ListWmsStockRequestsParams,
) {
  const response = await apiClient.get<WmsStockRequest[]>("/wms/stock-requests", {
    params: {
      tenantId: params?.tenantId || undefined,
      storeId: params?.storeId || undefined,
      status: params?.status || undefined,
      search: params?.search || undefined,
      limit: params?.limit,
    },
  });
  return response.data;
}

export async function fetchWmsStockRequest(id: string) {
  const response = await apiClient.get<WmsStockRequest>(
    `/wms/stock-requests/${id}`,
  );
  return response.data;
}

export async function createWmsStockRequest(
  payload: CreateWmsStockRequestInput,
) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      "/wms/stock-requests",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to create stock request."));
  }
}

export async function updateWmsStockRequest(
  id: string,
  payload: Partial<CreateWmsStockRequestInput>,
) {
  try {
    const response = await apiClient.patch<WmsStockRequest>(
      `/wms/stock-requests/${id}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to update stock request."));
  }
}

export async function submitWmsStockRequest(id: string) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      `/wms/stock-requests/${id}/submit`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to submit stock request."));
  }
}

export async function reviewWmsStockRequest(
  id: string,
  payload: ReviewWmsStockRequestInput,
) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      `/wms/stock-requests/${id}/review`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to review stock request."));
  }
}

export async function respondToWmsStockRequest(
  id: string,
  payload: RespondWmsStockRequestInput,
) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      `/wms/stock-requests/${id}/respond`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to send partner response."),
    );
  }
}

export async function startWmsStockRequestAudit(id: string) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      `/wms/stock-requests/${id}/start-audit`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to start request audit."));
  }
}

export async function auditWmsStockRequest(
  id: string,
  payload: AuditWmsStockRequestInput,
) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      `/wms/stock-requests/${id}/audit`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to complete request audit."));
  }
}

export async function markWmsStockRequestInProcurement(id: string) {
  try {
    const response = await apiClient.post<WmsStockRequest>(
      `/wms/stock-requests/${id}/procure`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to move request into procurement."),
    );
  }
}

export async function fetchWmsInvoices(params?: ListWmsInvoicesParams) {
  const response = await apiClient.get<WmsInvoiceListItem[]>("/wms/invoices", {
    params: {
      tenantId: params?.tenantId || undefined,
      status: params?.status || undefined,
      search: params?.search || undefined,
      limit: params?.limit,
    },
  });
  return response.data;
}

export async function fetchWmsPayments(params?: ListWmsPaymentsParams) {
  const response = await apiClient.get<WmsStockRequestPayment[]>(
    "/wms/payments",
    {
      params: {
        tenantId: params?.tenantId || undefined,
        status: params?.status || undefined,
        search: params?.search || undefined,
        limit: params?.limit,
      },
    },
  );
  return response.data;
}

export async function submitWmsStockRequestPayment(
  requestId: string,
  payload: CreateWmsStockRequestPaymentInput,
) {
  try {
    const response = await apiClient.post<WmsStockRequestPayment>(
      `/wms/stock-requests/${requestId}/payments`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to submit payment proof."),
    );
  }
}

export async function verifyWmsStockRequestPayment(
  paymentId: string,
  payload: VerifyWmsStockRequestPaymentInput,
) {
  try {
    const response = await apiClient.post<WmsStockRequestPayment>(
      `/wms/payments/${paymentId}/verify`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to verify payment proof."),
    );
  }
}
