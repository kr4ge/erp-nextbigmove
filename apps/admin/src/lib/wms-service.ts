import apiClient from '@/lib/api-client';

export type WmsBootstrapResponse = {
  tenantReady: boolean;
  stockTruth: {
    serializedByDefault: boolean;
    receivingOwnsStockCreation: boolean;
    inventoryTruth: string;
  };
  readiness: {
    posStores: number;
    posWarehouses: number;
    posProducts: number;
  };
  modules: Array<{
    key: string;
    label: string;
    permission: string;
  }>;
  context: {
    userRole: string | null;
    tenantId: string | null;
  };
};

export async function fetchWmsBootstrap(): Promise<WmsBootstrapResponse> {
  const response = await apiClient.get('/wms/core/bootstrap');
  return response.data as WmsBootstrapResponse;
}
