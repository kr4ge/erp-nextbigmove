import type { DeviceIdentity } from '@/src/features/auth/types';
import { apiRequest } from '@/src/shared/services/http';
import type { HistoryActivityFilter, WmsMobileHistoryFeedResponse } from '../types';

type HistoryRequestParams = {
  accessToken: string;
  device: DeviceIdentity;
  tenantId?: string | null;
  actorId?: string | null;
  type?: HistoryActivityFilter;
  cursor?: string | null;
  limit?: number;
};

export function fetchMobileHistoryFeed(params: HistoryRequestParams) {
  const query: string[] = [];

  if (params.tenantId) {
    query.push(`tenantId=${encodeURIComponent(params.tenantId)}`);
  }

  if (params.actorId) {
    query.push(`actorId=${encodeURIComponent(params.actorId)}`);
  }

  if (params.type) {
    query.push(`type=${encodeURIComponent(params.type)}`);
  }

  if (params.cursor) {
    query.push(`cursor=${encodeURIComponent(params.cursor)}`);
  }

  if (params.limit) {
    query.push(`limit=${encodeURIComponent(String(params.limit))}`);
  }

  return apiRequest<WmsMobileHistoryFeedResponse>(
    `/wms/mobile/history/feed${query.length ? `?${query.join('&')}` : ''}`,
    {
      method: 'GET',
      token: params.accessToken,
      device: params.device,
    },
  );
}
