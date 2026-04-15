import apiClient from "@/lib/api-client";
import type {
  CreateWmsPackingStationInput,
  ListWmsFulfillmentOrdersParams,
  UpdateWmsPackingStationInput,
  WmsFulfillmentOperator,
  WmsFulfillmentOrder,
  WmsFulfillmentOrderStatus,
  WmsPackingStation,
} from "../_types/fulfillment";

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

export async function fetchWmsFulfillmentOrders(
  params: ListWmsFulfillmentOrdersParams,
) {
  const response = await apiClient.get<WmsFulfillmentOrder[]>(
    "/wms/fulfillment/orders",
    {
      params: {
        view: params.view,
        tenantId: params.tenantId || undefined,
        storeId: params.storeId || undefined,
        warehouseId: params.warehouseId || undefined,
        status: params.status || undefined,
        search: params.search || undefined,
        limit: params.limit,
      },
    },
  );
  return response.data;
}

export async function fetchWmsFulfillmentOrder(orderId: string) {
  const response = await apiClient.get<WmsFulfillmentOrder>(
    `/wms/fulfillment/orders/${orderId}`,
  );
  return response.data;
}

export async function syncWmsFulfillmentIntake(limit = 200) {
  try {
    const response = await apiClient.post<{
      syncedAt: string;
      totalEligible: number;
      created: number;
      updated: number;
      skipped: number;
    }>("/wms/fulfillment/intake/sync", { limit });
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to sync fulfillment intake."),
    );
  }
}

export async function fetchWmsFulfillmentOperators() {
  const response = await apiClient.get<WmsFulfillmentOperator[]>(
    "/wms/fulfillment/operators",
  );
  return response.data;
}

export async function fetchWmsPackingStations(warehouseId?: string) {
  const response = await apiClient.get<WmsPackingStation[]>(
    "/wms/fulfillment/stations",
    {
      params: {
        warehouseId: warehouseId || undefined,
      },
    },
  );
  return response.data;
}

export async function createWmsPackingStation(
  payload: CreateWmsPackingStationInput,
) {
  try {
    const response = await apiClient.post<WmsPackingStation>(
      "/wms/fulfillment/stations",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to create packing station."),
    );
  }
}

export async function updateWmsPackingStation(
  stationId: string,
  payload: UpdateWmsPackingStationInput,
) {
  try {
    const response = await apiClient.patch<WmsPackingStation>(
      `/wms/fulfillment/stations/${stationId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to update packing station."),
    );
  }
}

export async function setWmsFulfillmentOrderStatus(
  orderId: string,
  status: WmsFulfillmentOrderStatus,
) {
  try {
    const response = await apiClient.post<WmsFulfillmentOrder>(
      `/wms/fulfillment/orders/${orderId}/status`,
      { status },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to change fulfillment order status."),
    );
  }
}

export async function startWmsFulfillmentPicking(
  orderId: string,
  trackingNumber: string,
) {
  try {
    const response = await apiClient.post<WmsFulfillmentOrder>(
      `/wms/fulfillment/orders/${orderId}/picking/start`,
      { trackingNumber },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to start picker session."),
    );
  }
}

export async function scanWmsFulfillmentPickUnit(
  orderId: string,
  unitBarcode: string,
) {
  try {
    const response = await apiClient.post<WmsFulfillmentOrder>(
      `/wms/fulfillment/orders/${orderId}/picking/scan`,
      { unitBarcode },
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to scan picked unit."));
  }
}

export async function assignWmsFulfillmentPacking(
  orderId: string,
  payload: {
    stationId: string;
    packerUserId: string;
  },
) {
  try {
    const response = await apiClient.post<WmsFulfillmentOrder>(
      `/wms/fulfillment/orders/${orderId}/packing/assign`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to assign packing station."),
    );
  }
}

export async function startWmsFulfillmentPacking(
  orderId: string,
  trackingNumber: string,
) {
  try {
    const response = await apiClient.post<WmsFulfillmentOrder>(
      `/wms/fulfillment/orders/${orderId}/packing/start`,
      { trackingNumber },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to start packing session."),
    );
  }
}

export async function scanWmsFulfillmentPackUnit(
  orderId: string,
  unitBarcode: string,
) {
  try {
    const response = await apiClient.post<WmsFulfillmentOrder>(
      `/wms/fulfillment/orders/${orderId}/packing/scan`,
      { unitBarcode },
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, "Unable to scan packed unit."));
  }
}
