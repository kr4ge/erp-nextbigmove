export type CreateWmsStockReceiptItemInput = {
  sourceProductId?: string;
  requestLineId?: string;
  sku: string;
  productName: string;
  variationId?: string;
  variationName?: string;
  barcode?: string;
  quantity: number;
  unitCost: number;
  lotCode?: string;
  supplierBatchNo?: string;
};

export type CreateWmsStockReceiptInput = {
  requestId?: string;
  warehouseId: string;
  locationId: string;
  supplierName?: string;
  supplierReference?: string;
  receivedAt?: string;
  currency?: string;
  notes?: string;
  items: CreateWmsStockReceiptItemInput[];
};

export type WmsStockReceiptItem = {
  id: string;
  lineNo: number;
  sku: string;
  productName: string;
  variationName?: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  lotCode: string;
};

export type WmsStockReceipt = {
  id: string;
  receiptCode: string;
  status: string;
  requestId?: string | null;
  supplierName?: string | null;
  supplierReference?: string | null;
  receivedAt: string;
  totalItems: number;
  totalQuantity: number;
  totalCost: number;
  currency: string;
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  actorUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: WmsStockReceiptItem[];
};
