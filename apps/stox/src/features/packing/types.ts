import type { WmsMobilePickingTask } from '@/src/features/picking/types';

export type PackingFilters = {
  tenantId: string | null;
  storeId: string | null;
};

export type PackingStatusFilter =
  | 'PICKED'
  | 'PACKING'
  | 'AWAITING_TRACKING'
  | 'PACKED';

export type WmsMobilePackingResponse = {
  tenantReady: boolean;
  serverTime: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  context: {
    tenantOptions?: Array<{
      id: string;
      name: string;
      slug: string;
      status?: string | null;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
    stores: Array<{
      id: string;
      tenantId?: string | null;
      name: string;
      tenantName?: string | null;
      tenantSlug?: string | null;
    }>;
  };
  summary: {
    held: number;
    packing: number;
    awaitingTracking: number;
  };
  tasks: WmsMobilePickingTask[];
};
