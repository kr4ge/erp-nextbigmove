export type WmsPurchasingRequestType = 'PROCUREMENT' | 'SELF_BUY';

export type WmsPurchasingBatchStatus =
  | 'UNDER_REVIEW'
  | 'REVISION'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_REVIEW'
  | 'RECEIVING_READY'
  | 'RECEIVING'
  | 'STOCKED'
  | 'REJECTED'
  | 'CANCELED';

export type WmsPurchasingBatchRow = {
  id: string;
  requestType: WmsPurchasingRequestType;
  status: WmsPurchasingBatchStatus;
  sourceType: string;
  sourceRequestId: string | null;
  sourceStatus: string | null;
  requestTitle: string | null;
  store: {
    id: string;
    name: string;
  };
  lineCount: number;
  requestedQuantity: number;
  approvedQuantity: number;
  receivedQuantity: number;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  paymentProofImageUrl: string | null;
  paymentSubmittedAt: string | null;
  paymentProofSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  readyForReceivingAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WmsPurchasingBatchDetail = WmsPurchasingBatchRow & {
  sourceRequestType: number | null;
  sourceSnapshot: Record<string, unknown> | null;
  partnerNotes: string | null;
  wmsNotes: string | null;
  invoice: {
    number: string | null;
    amount: number | null;
    bankDetails: {
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      billingCompanyName: string | null;
      billingAddress: string | null;
      bankName: string | null;
      bankAccountName: string | null;
      bankAccountNumber: string | null;
      bankAccountType: string | null;
      bankBranch: string | null;
      paymentInstructions: string | null;
    } | null;
  };
  paymentProofSubmittedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  lines: Array<{
    id: string;
    lineNo: number;
    sourceItemId: string | null;
    sourceSnapshot: Record<string, unknown> | null;
    productId: string | null;
    variationId: string | null;
    requestedProductName: string | null;
    uom: string | null;
    requestedQuantity: number;
    approvedQuantity: number | null;
    receivedQuantity: number;
    partnerUnitCost: number | null;
    supplierUnitCost: number | null;
    needsProfiling: boolean;
    resolvedPosProduct: {
      id: string;
      name: string;
      customId: string | null;
    } | null;
    resolvedProfile: {
      id: string;
      status: string;
      isSerialized: boolean;
    } | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    fromStatus: WmsPurchasingBatchStatus | null;
    toStatus: WmsPurchasingBatchStatus | null;
    message: string | null;
    payload: Record<string, unknown> | null;
    actor: {
      id: string;
      name: string;
      email: string;
    } | null;
    createdAt: string;
  }>;
};

export type WmsPurchasingOverviewResponse = {
  tenantReady: boolean;
  summary: {
    batches: number;
    procurement: number;
    selfBuy: number;
    readyForReceiving: number;
    underReview: number;
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
      label: string;
      batchCount: number;
    }>;
    requestTypes: Array<{
      value: WmsPurchasingRequestType;
      label: string;
      batchCount: number;
    }>;
    statuses: Array<{
      value: WmsPurchasingBatchStatus;
      label: string;
      batchCount: number;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
    activeRequestType: WmsPurchasingRequestType | null;
    activeStatus: WmsPurchasingBatchStatus | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  batches: WmsPurchasingBatchRow[];
};

export type GetWmsPurchasingOverviewParams = {
  tenantId?: string;
  storeId?: string;
  requestType?: WmsPurchasingRequestType;
  status?: WmsPurchasingBatchStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type GetWmsPurchasingProductOptionsParams = {
  tenantId?: string;
  storeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type WmsPurchasingProductOption = {
  profileId: string;
  posProductId: string;
  status: 'DEFAULT' | 'READY' | 'ARCHIVED';
  isSerialized: boolean;
  productId: string;
  variationId: string;
  variationDisplayId: string | null;
  productCustomId: string | null;
  name: string;
  retailPrice: number | null;
  inhouseUnitCost: number | null;
  supplierUnitCost: number | null;
  store: {
    id: string;
    name: string;
  };
};

export type WmsPurchasingProductOptionsResponse = {
  tenantReady: boolean;
  filters: {
    tenants: Array<{
      id: string;
      label: string;
      slug: string;
      status: string;
    }>;
    stores: Array<{
      id: string;
      label: string;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  products: WmsPurchasingProductOption[];
};

export type CreateWmsPurchasingBatchLineInput = {
  lineNo?: number;
  sourceItemId?: string;
  sourceSnapshot?: Record<string, unknown>;
  productId?: string;
  variationId?: string;
  requestedProductName?: string;
  uom?: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  partnerUnitCost?: number;
  supplierUnitCost?: number;
  needsProfiling?: boolean;
  resolvedPosProductId?: string;
  resolvedProfileId?: string;
  notes?: string;
};

export type CreateWmsPurchasingBatchInput = {
  storeId: string;
  teamId?: string;
  requestType: WmsPurchasingRequestType;
  sourceType?: 'ERP_REQUEST' | 'MANUAL_WMS';
  sourceRequestId?: string;
  sourceRequestType?: number;
  sourceStatus?: string;
  sourceSnapshot?: Record<string, unknown>;
  requestTitle?: string;
  partnerNotes?: string;
  wmsNotes?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  paymentSubmittedAt?: string;
  paymentProofImageUrl?: string;
  paymentVerifiedAt?: string;
  lines: CreateWmsPurchasingBatchLineInput[];
};

export type SubmitWmsPurchasingPaymentProofInput = {
  paymentProofImageUrl: string;
  message?: string;
};

export type RespondWmsPurchasingRevisionInput = {
  decision: 'ACCEPT' | 'REJECT';
  message?: string;
};
