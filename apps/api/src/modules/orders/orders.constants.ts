export const CONFIRMATION_UPDATE_QUEUE = 'orders-confirmation-update';
export const CONFIRMATION_UPDATE_STATUS_JOB = 'update-status';

export interface ConfirmationUpdateTagPayload {
  id: string;
  name: string;
}

export interface ConfirmationUpdateStatusJobData {
  tenantId: string;
  orderRowId: string;
  shopId: string;
  posOrderId: string;
  targetStatus?: number | null;
  targetTags?: ConfirmationUpdateTagPayload[] | null;
  targetNote?: string;
  targetNotePrint?: string;
  requestId?: string;
}
