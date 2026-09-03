import apiClient from '@/lib/api-client';
import type {
  GetWmsOutboundRecordsParams,
  WmsOutboundRecordsResponse,
} from '../_types/outbound-records';

export async function fetchWmsOutboundRecords(params: GetWmsOutboundRecordsParams = {}) {
  const response = await apiClient.get('/wms/inventory/outbound-records', {
    params: {
      ...(params.allTenants ? { allTenants: true } : {}),
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.productProfileId ? { productProfileId: params.productProfileId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.startDate ? { startDate: params.startDate } : {}),
      ...(params.endDate ? { endDate: params.endDate } : {}),
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });

  return response.data as WmsOutboundRecordsResponse;
}
