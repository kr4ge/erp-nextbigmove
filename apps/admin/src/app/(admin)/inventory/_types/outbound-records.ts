export type WmsOutboundUnitStatus = 'SHIPPED' | 'DELIVERED' | 'RETURNING' | 'RETURNED';

export type WmsOutboundUnitRecord = {
  id: string;
  activity: WmsOutboundUnitStatus;
  status: WmsOutboundUnitStatus;
  eventAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  returningAt: string | null;
  returnedAt: string | null;
  trackingCode: string | null;
  unit: {
    id: string;
    code: string;
    barcode: string;
  };
  product: {
    profileId: string;
    variationId: string;
    name: string;
    customId: string | null;
  };
  tenant: {
    id: string;
    name: string;
  };
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  order: {
    id: string;
    posOrderId: string;
    shopId: string;
  };
};

export type WmsOutboundRecordsResponse = {
  tenantReady: boolean;
  serverTime: string;
  summary: {
    shipped: number;
    delivered: number;
    returning: number;
    returned: number;
  };
  filters: {
    tenants: Array<{
      id: string;
      label: string;
      slug: string;
      status: string;
    }>;
    stores: Array<{
      id: string;
      tenantId: string;
      name: string;
      label: string;
    }>;
    products: Array<{
      id: string;
      tenantId: string;
      storeId: string;
      variationId: string;
      name: string;
      customId: string | null;
      label: string;
    }>;
    statuses: Array<{
      value: WmsOutboundUnitStatus;
      label: string;
      recordCount: number;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
    activeProductProfileId: string | null;
    activeStatus: WmsOutboundUnitStatus | null;
    startDate: string;
    endDate: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  records: WmsOutboundUnitRecord[];
};

export type GetWmsOutboundRecordsParams = {
  allTenants?: boolean;
  tenantId?: string;
  storeId?: string;
  productProfileId?: string;
  status?: WmsOutboundUnitStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type OutboundDateRange = {
  startDate: string;
  endDate: string;
};
