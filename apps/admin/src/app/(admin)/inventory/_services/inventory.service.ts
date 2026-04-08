import apiClient from "@/lib/api-client";
import type {
  CreateWmsInventoryAdjustmentInput,
  CreateWmsInventoryTransferInput,
  ListWmsInventoryTransfersParams,
  ListWmsInventoryUnitsParams,
  ListWmsPosProductsParams,
  WmsInventoryAdjustment,
  WmsInventoryBalance,
  WmsInventoryLedgerEntry,
  WmsInventoryLot,
  WmsInventoryOverview,
  WmsInventoryTransfer,
  WmsInventoryUnit,
  WmsPosProductFilters,
  WmsPosProductCatalogItem,
  WmsSkuProfile,
  UpsertWmsSkuProfileInput,
} from "../_types/inventory";

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

export async function fetchInventoryOverview() {
  const response = await apiClient.get<WmsInventoryOverview>(
    "/wms/inventory/overview",
  );
  return response.data;
}

export async function fetchInventoryBalances() {
  const response = await apiClient.get<WmsInventoryBalance[]>(
    "/wms/inventory/balances",
  );
  return response.data;
}

export async function fetchInventoryLots() {
  const response = await apiClient.get<WmsInventoryLot[]>(
    "/wms/inventory/lots",
  );
  return response.data;
}

export async function fetchInventoryUnits(params?: ListWmsInventoryUnitsParams) {
  const response = await apiClient.get<WmsInventoryUnit[]>(
    "/wms/inventory/units",
    {
      params: {
        warehouseId: params?.warehouseId || undefined,
        locationId: params?.locationId || undefined,
        status: params?.status || undefined,
        search: params?.search || undefined,
      },
    },
  );
  return response.data;
}

export async function fetchInventoryLedger() {
  const response = await apiClient.get<WmsInventoryLedgerEntry[]>(
    "/wms/inventory/ledger",
  );
  return response.data;
}

export async function fetchInventoryAdjustments() {
  const response = await apiClient.get<WmsInventoryAdjustment[]>(
    "/wms/inventory/adjustments",
  );
  return response.data;
}

export async function fetchInventoryTransfers(
  params?: ListWmsInventoryTransfersParams,
) {
  const response = await apiClient.get<WmsInventoryTransfer[]>(
    "/wms/inventory/transfers",
    {
      params: {
        warehouseId: params?.warehouseId || undefined,
        fromLocationId: params?.fromLocationId || undefined,
        toLocationId: params?.toLocationId || undefined,
        limit: params?.limit,
      },
    },
  );
  return response.data;
}

export async function createInventoryAdjustment(
  payload: CreateWmsInventoryAdjustmentInput,
) {
  try {
    const response = await apiClient.post<WmsInventoryAdjustment>(
      "/wms/inventory/adjustments",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to post inventory adjustment."),
    );
  }
}

export async function createInventoryTransfer(
  payload: CreateWmsInventoryTransferInput,
) {
  try {
    const response = await apiClient.post<WmsInventoryTransfer>(
      "/wms/inventory/transfers",
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to post inventory transfer."),
    );
  }
}

export async function fetchInventoryPosProducts(
  params?: ListWmsPosProductsParams,
) {
  const response = await apiClient.get<WmsPosProductCatalogItem[]>(
    "/wms/inventory/catalog/pos-products",
    {
      params: {
        search: params?.search || undefined,
        tenantId: params?.tenantId || undefined,
        storeId: params?.storeId || undefined,
        profiledOnly: params?.profiledOnly || undefined,
        limit: params?.limit,
      },
    },
  );
  return response.data;
}

export async function fetchInventoryPosProductFilters(tenantId?: string) {
  const response = await apiClient.get<WmsPosProductFilters>(
    "/wms/inventory/catalog/pos-products/filters",
    {
      params: {
        tenantId: tenantId || undefined,
      },
    },
  );
  return response.data;
}

export async function upsertInventorySkuProfile(
  posProductId: string,
  payload: UpsertWmsSkuProfileInput,
) {
  try {
    const response = await apiClient.put<WmsSkuProfile>(
      `/wms/inventory/catalog/pos-products/${posProductId}/sku-profile`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to save WMS SKU profile."),
    );
  }
}

export async function deleteInventorySkuProfile(posProductId: string) {
  try {
    const response = await apiClient.delete<{ success: true }>(
      `/wms/inventory/catalog/pos-products/${posProductId}/sku-profile`,
    );
    return response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Unable to remove WMS SKU profile."),
    );
  }
}
