export const CONFIRMATION_UPDATE_QUEUE = 'orders-confirmation-update';
export const CONFIRMATION_UPDATE_STATUS_JOB = 'update-status';
export const AGING_ORDERS_NOTIFICATION_ENTITY_TYPE = 'AGING_ORDER_BUCKET';
export const AGING_ORDERS_NOTIFICATION_THRESHOLD_DAYS = 2;
export const ORDERS_AGING_NOTIFICATION_UPDATED_EVENT = 'orders:summary:aging:updated';
export const ORDERS_STATUS_SUMMARY_UPDATED_EVENT = 'orders:summary:status:updated';

export const AGING_ORDERS_NOTIFICATION_BUCKET_KEYS = [
  'new_orders',
  'restocking',
  'confirmed',
  'printed',
  'waiting_pickup',
  'shipped',
  'rts',
] as const;

export type AgingOrdersNotificationBucketKey =
  typeof AGING_ORDERS_NOTIFICATION_BUCKET_KEYS[number];

export interface ConfirmationUpdateTagPayload {
  id: string;
  name: string;
}

export interface ConfirmationUpdateItemPayload {
  variation_id: string;
  quantity: number;
}

export interface ConfirmationUpdateStatusJobData {
  tenantId: string;
  orderRowId: string;
  shopId: string;
  posOrderId: string;
  targetStatus?: number | null;
  targetTags?: ConfirmationUpdateTagPayload[] | null;
  targetItems?: ConfirmationUpdateItemPayload[] | null;
  targetNote?: string;
  targetNotePrint?: string;
  targetShippingAddress?: Record<string, unknown> | null;
  targetShippingFee?: number | null;
  targetTotalDiscount?: number | null;
  targetBankPayments?: unknown;
  targetSurcharge?: number | null;
  requestId?: string;
  source?: 'confirmation' | 'wms_picking';
  allowedCurrentStatuses?: number[];
}
