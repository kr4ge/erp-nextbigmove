export const WMS_PICKING_HANDOFF_QUEUE = 'wms-picking-handoff';
export const WMS_PICKING_HANDOFF_WAITING_FOR_PRINTING_JOB = 'wms-picking-handoff-waiting-for-printing';
export const WMS_PACKING_POST_COMPLETE_QUEUE = 'wms-packing-post-complete';
export const WMS_PACKING_POST_COMPLETE_SYNC_JOB = 'wms-packing-post-complete-sync';

export type WmsPickingHandoffWaitingForPrintingJobData = {
  basketId: string;
  basketCode: string | null;
  requestedAt: string;
  orders: Array<{
    id: string;
    tenantId: string;
    storeId: string;
    posOrderDbId: string;
    shopId: string;
    posOrderId: string;
    warehouseId: string | null;
  }>;
};

export type WmsPackingPostCompleteJobData = {
  fulfillmentOrderId: string;
  tenantId: string;
  storeId: string;
  shopId: string;
  posOrderId: string;
  requestedAt: string;
};
