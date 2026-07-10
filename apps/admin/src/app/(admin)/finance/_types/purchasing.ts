export type WmsPurchasingRequestType = 'PROCUREMENT' | 'SELF_BUY';

export type WmsInvoiceSourceType = 'MANUAL' | 'MANUAL_RECEIVING' | 'PROCUREMENT';

export type WmsInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID_PENDING_VERIFY'
  | 'PAID_VERIFIED'
  | 'CANCELED';

export type WmsInvoiceLineType = 'SOURCE' | 'CUSTOM';

export type WmsLinkedInvoiceSummary = {
  id: string;
  sourceType: WmsInvoiceSourceType;
  status: WmsInvoiceStatus;
  invoiceNumber: string;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  totalAmount: number;
  amountDue: number;
};

export type WmsPurchasingBatchStatus =
  | 'UNDER_REVIEW'
  | 'REVISION'
  | 'AWAITING_PRODUCTS'
  | 'SHIPPED'
  | 'RECEIVING_EXCEPTION'
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
    linked: WmsLinkedInvoiceSummary | null;
    bankDetails: {
      warehouseId: string | null;
      warehouseCode: string | null;
      warehouseName: string | null;
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

export type UpdateWmsPurchasingStatusInput = {
  status: WmsPurchasingBatchStatus;
  message?: string;
  wmsNotes?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  paymentSubmittedAt?: string;
  paymentProofImageUrl?: string;
  paymentVerifiedAt?: string;
  sourceStatus?: string;
};

export type UpdateWmsPurchasingLineInput = {
  approvedQuantity?: number;
  receivedQuantity?: number;
  partnerUnitCost?: number;
  supplierUnitCost?: number;
  needsProfiling?: boolean;
  resolvedPosProductId?: string;
  resolvedProfileId?: string;
  notes?: string;
};

export type WmsInvoiceRow = {
  id: string;
  tenantId: string;
  sourceType: WmsInvoiceSourceType;
  sourceRefId: string | null;
  sourceRefCode: string | null;
  status: WmsInvoiceStatus;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  notes: string | null;
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
  amountDue: number;
  createdAt: string;
  updatedAt: string;
};

export type WmsInvoiceDetail = WmsInvoiceRow & {
  issuer: Record<string, unknown>;
  billTo: Record<string, unknown>;
  totals: {
    lineCount: number | null;
    totalQuantity: number | null;
    subtotal: number | null;
    totalAmount: number | null;
    amountDue: number | null;
  };
  lines: Array<{
    id: string;
    lineNo: number;
    lineType: WmsInvoiceLineType;
    storeId: string | null;
    store: {
      id: string;
      name: string;
    } | null;
    productId: string | null;
    variationId: string | null;
    description: string;
    quantity: number;
    unitRate: number;
    amount: number;
    rateSource: string | null;
    lineSnapshot: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  }>;
  activities: Array<{
    id: string;
    actionType: string;
    fromStatus: string | null;
    toStatus: string | null;
    metadata: Record<string, unknown> | null;
    actor: {
      id: string;
      name: string;
      email: string;
    } | null;
    createdAt: string;
  }>;
};

export type WmsInvoiceDocumentResponse = {
  invoice: WmsInvoiceDetail;
  document: {
    title: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
    issuer: Record<string, unknown> & {
      logoUrl?: string | null;
    };
    billTo: Record<string, unknown>;
    payment: {
      bankName: string | null;
      bankAccountName: string | null;
      bankAccountNumber: string | null;
      bankAccountType: string | null;
      bankBranch: string | null;
      paymentInstructions: string | null;
      footerNotes: string | null;
    };
    source: {
      type: WmsInvoiceSourceType;
      referenceCode: string | null;
    };
    generatedAt: string;
  };
};

export type WmsInvoiceOverviewResponse = {
  tenantReady: boolean;
  summary: {
    invoices: number;
    draft: number;
    issued: number;
    paidPendingVerify: number;
    paidVerified: number;
    canceled: number;
    totalBilledAmount: number;
    totalAmountDue: number;
    draftAmount: number;
    issuedAmount: number;
    paidPendingVerifyAmount: number;
    paidVerifiedAmount: number;
    canceledAmount: number;
  };
  filters: {
    tenants: Array<{
      id: string;
      label: string;
      slug: string;
      status: string;
    }>;
    statuses: Array<{
      value: WmsInvoiceStatus;
      label: string;
      invoiceCount: number;
    }>;
    sourceTypes: Array<{
      value: WmsInvoiceSourceType;
      label: string;
      invoiceCount: number;
    }>;
    activeTenantId: string | null;
    activeStatus: WmsInvoiceStatus | null;
    activeSourceType: WmsInvoiceSourceType | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  invoices: WmsInvoiceRow[];
};

export type GetWmsInvoiceOverviewParams = {
  tenantId?: string;
  sourceType?: WmsInvoiceSourceType;
  status?: WmsInvoiceStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type WmsInvoiceLineInput = {
  lineNo?: number;
  storeId?: string;
  productId?: string;
  variationId?: string;
  description: string;
  quantity: number;
  unitRate: number;
  rateSource?: string;
  lineType?: WmsInvoiceLineType;
};

export type CreateWmsInvoiceInput = {
  invoiceNumber?: string;
  status?: WmsInvoiceStatus;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  notes?: string;
  lines: WmsInvoiceLineInput[];
};

export type UpdateWmsInvoiceInput = {
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string;
  notes?: string | null;
  lines?: WmsInvoiceLineInput[];
};

export type UpdateWmsInvoiceStatusInput = {
  status: WmsInvoiceStatus;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
};
