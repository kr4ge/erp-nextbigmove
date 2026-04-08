export type WmsRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "WMS_REVIEWED"
  | "PARTNER_CONFIRMED"
  | "PARTNER_REJECTED"
  | "UNDER_AUDIT"
  | "FEEDBACK_REQUIRED"
  | "AUDIT_ACCEPTED"
  | "INVOICED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_VERIFIED"
  | "IN_PROCUREMENT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELED";

export type WmsRequestType = "WMS_PROCUREMENT" | "PARTNER_SELF_BUY";

export type WmsInvoiceStatus =
  | "UNPAID"
  | "PAYMENT_SUBMITTED"
  | "PAID"
  | "CANCELED";

export type WmsPaymentStatus = "SUBMITTED" | "VERIFIED" | "REJECTED";

export type WmsBillingAddress = {
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  country: string;
};

export type WmsPartnerType = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type WmsCompanyBillingSettings = {
  id: string;
  companyName: string;
  billingAddress: WmsBillingAddress | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  notes: string | null;
  updatedAt: string;
};

export type UpsertWmsCompanyBillingSettingsInput = {
  companyName: string;
  billingAddress: WmsBillingAddress;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  notes?: string;
};

export type WmsRequestProduct = {
  id: string;
  productId: string | null;
  variationId: string | null;
  variationCustomId: string | null;
  customId: string | null;
  name: string;
  retailPrice: number | null;
  imageUrl: string | null;
  store: {
    id: string;
    name: string;
    shopId: string;
    shopName: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    companyName: string | null;
    billingAddress: WmsBillingAddress | null;
  };
  skuProfile: {
    id: string;
    code: string | null;
    barcode: string | null;
    status: string;
    isSerialized: boolean;
    supplierCost: number | null;
    wmsUnitPrice: number | null;
    isRequestable: boolean;
  } | null;
};

export type WmsForecastRow = WmsRequestProduct & {
  forecast: {
    runDate: string;
    remainingStock: number;
    pending: number;
    pastTwoDays: number;
    returning: number;
    recommendedQuantity: number;
    suggestedQuantity: number;
  };
};

export type WmsRequestDraftRow = WmsForecastRow & {
  requestedQuantity: number;
  partnerNotes: string;
  declaredUnitCost: number;
};

export type ListWmsForecastsParams = {
  tenantId: string;
  storeId?: string;
  search?: string;
  requestType?: WmsRequestType;
  runDate?: string;
  requestableOnly?: boolean;
  profileOnly?: boolean;
  limit?: number;
};

export type ListWmsRequestProductsParams = {
  tenantId?: string;
  storeId?: string;
  search?: string;
  requestableOnly?: boolean;
  profileOnly?: boolean;
  limit?: number;
};

export type WmsStockRequestLineInput = {
  posProductId: string;
  remainingQuantity?: number;
  pendingQuantity?: number;
  pastTwoDaysQuantity?: number;
  returningQuantity?: number;
  recommendedQuantity?: number;
  requestedQuantity: number;
  declaredUnitCost?: number;
  partnerNotes?: string;
};

export type CreateWmsStockRequestInput = {
  tenantId: string;
  storeId?: string;
  requestType?: WmsRequestType;
  forecastRunDate?: string;
  orderingWindow?: string;
  internalNotes?: string;
  currency?: string;
  adjustmentAmount?: number;
  submit?: boolean;
  items: WmsStockRequestLineInput[];
};

export type UpdateWmsStockRequestInput = {
  forecastRunDate?: string;
  orderingWindow?: string;
  internalNotes?: string;
  adjustmentAmount?: number;
  items?: WmsStockRequestLineInput[];
};

export type ReviewWmsStockRequestInput = {
  reviewRemarks?: string;
  adjustmentAmount?: number;
  items: Array<{
    id: string;
    isActive?: boolean;
    requestedQuantity?: number;
    supplierCost?: number;
    wmsUnitPrice?: number;
    reviewRemarks?: string;
  }>;
};

export type RespondWmsStockRequestInput = {
  action: "CONFIRM" | "REJECT";
  note?: string;
};

export type AuditWmsStockRequestInput = {
  action: "ACCEPT" | "FEEDBACK";
  auditRemarks?: string;
  items: Array<{
    id: string;
    deliveredQuantity: number;
    acceptedQuantity: number;
    confirmedUnitCost: number;
    auditRemarks?: string;
  }>;
};

export type ListWmsStockRequestsParams = {
  tenantId?: string;
  storeId?: string;
  status?: WmsRequestStatus;
  search?: string;
  limit?: number;
};

export type WmsStockRequestLine = {
  id: string;
  lineNo: number;
  posProductId: string;
  skuProfileId: string | null;
  sku: string | null;
  productName: string;
  variationId: string | null;
  variationCustomId: string | null;
  variationName: string | null;
  barcode: string | null;
  requestedQuantity: number;
  recommendedQuantity: number | null;
  remainingQuantity: number | null;
  pendingQuantity: number | null;
  pastTwoDaysQuantity: number | null;
  returningQuantity: number | null;
  deliveredQuantity: number;
  acceptedQuantity: number;
  receivedQuantity: number;
  declaredUnitCost: number | null;
  confirmedUnitCost: number | null;
  supplierCost: number | null;
  wmsUnitPrice: number;
  lineAmount: number;
  isActive: boolean;
  partnerNotes: string | null;
  reviewRemarks: string | null;
  auditRemarks: string | null;
};

export type WmsStockRequestInvoiceLine = {
  id: string;
  lineNo: number;
  requestLineId?: string | null;
  posProductId?: string | null;
  sku?: string | null;
  productName: string;
  variationId?: string | null;
  variationCustomId?: string | null;
  variationName?: string | null;
  quantity: number;
  supplierCost: number | null;
  wmsUnitPrice: number;
  lineAmount: number;
};

export type WmsStockRequestInvoice = {
  id: string;
  invoiceCode: string;
  status: WmsInvoiceStatus;
  companyName: string;
  companyBillingAddress: WmsBillingAddress | null;
  partnerCompanyName: string;
  partnerBillingAddress: WmsBillingAddress | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  invoiceDate: string;
  dueDate: string;
  note: string | null;
  subtotal: number;
  adjustmentAmount: number;
  totalAmount: number;
  amountDue: number;
  currency: string;
  lines: WmsStockRequestInvoiceLine[];
};

export type WmsStockRequestPayment = {
  id: string;
  status: WmsPaymentStatus;
  proofUrl: string | null;
  proofNote: string | null;
  remarks: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  request?: {
    id: string;
    requestCode: string;
    tenant: {
      id: string;
      name: string;
    };
  };
  invoice?: {
    id: string;
    invoiceCode: string;
  };
};

export type WmsStockRequest = {
  id: string;
  requestCode: string;
  requestType: WmsRequestType;
  status: WmsRequestStatus;
  forecastRunDate: string | null;
  orderingWindow: string | null;
  reviewRemarks: string | null;
  internalNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  partnerRespondedAt: string | null;
  auditStartedAt: string | null;
  auditCompletedAt: string | null;
  invoicedAt: string | null;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  procurementStartedAt: string | null;
  receivedAt: string | null;
  totalItems: number;
  totalQuantity: number;
  subtotal: number;
  adjustmentAmount: number;
  totalAmount: number;
  currency: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    companyName: string | null;
    billingAddress: WmsBillingAddress | null;
    partnerType: WmsPartnerType | null;
  };
  store: {
    id: string;
    name: string;
    shopId: string;
    shopName: string | null;
  } | null;
  items: WmsStockRequestLine[];
  invoice: WmsStockRequestInvoice | null;
  payments: WmsStockRequestPayment[];
};

export type WmsInvoiceListItem = {
  id: string;
  invoiceCode: string;
  status: WmsInvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  adjustmentAmount: number;
  totalAmount: number;
  amountDue: number;
  currency: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  request: {
    id: string;
    requestCode: string;
    status: WmsRequestStatus;
  };
  lines: Array<{
    id: string;
    lineNo: number;
    productName: string;
    variationName: string | null;
    quantity: number;
    wmsUnitPrice: number;
    lineAmount: number;
  }>;
  payments: Array<{
    id: string;
    status: WmsPaymentStatus;
    proofUrl: string | null;
    submittedAt: string;
  }>;
};

export type ListWmsInvoicesParams = {
  tenantId?: string;
  status?: WmsInvoiceStatus;
  search?: string;
  limit?: number;
};

export type ListWmsPaymentsParams = {
  tenantId?: string;
  status?: WmsPaymentStatus;
  search?: string;
  limit?: number;
};

export type CreateWmsStockRequestPaymentInput = {
  proofUrl: string;
  proofNote?: string;
};

export type VerifyWmsStockRequestPaymentInput = {
  approve: boolean;
  remarks?: string;
};
