export const WMS_DEMAND_QUEUE_REFRESH_QUEUE = 'wms-demand-queue-refresh';
export const WMS_DEMAND_QUEUE_REFRESH_JOB = 'wms-demand-queue-refresh-scope';

export type WmsDemandQueueRefreshJobData = {
  tenantId: string;
  storeId: string;
  requestedAt: string;
};
