export const PANCAKE_WEBHOOK_QUEUE = 'pancake-webhook';
export const PANCAKE_WEBHOOK_JOB = 'ingest';
export const PANCAKE_WEBHOOK_AUTO_CANCEL_JOB = 'auto-cancel-status';
export const PANCAKE_WEBHOOK_RECONCILE_QUEUE = 'pancake-webhook-reconcile';
export const PANCAKE_WEBHOOK_RECONCILE_JOB = 'reconcile-day';

export interface PancakeWebhookJobData {
  logId: string;
  requestId: string;
  tenantId: string;
  payload: any;
}

export interface PancakeWebhookReconcileJobData {
  tenantId: string;
  teamId: string | null;
  dateLocal: string;
  reconcileMode?: 'incremental' | 'full_reset';
  requestId?: string;
  logId?: string;
}

export interface PancakeWebhookAutoCancelJobData {
  tenantId: string;
  shopId: string;
  orderId: string;
  reportsByPhoneOrderFail: number | null;
  reportsByPhoneOrderSuccess: number | null;
  reportsByPhoneWarning: number | null;
  requestId?: string;
  logId?: string;
}
