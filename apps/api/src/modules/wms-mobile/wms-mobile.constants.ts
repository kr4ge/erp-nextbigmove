export const WMS_PICKING_HANDOFF_QUEUE = 'wms-picking-handoff';
export const WMS_PICKING_HANDOFF_WAITING_FOR_PRINTING_JOB = 'wms-picking-handoff-waiting-for-printing';

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
