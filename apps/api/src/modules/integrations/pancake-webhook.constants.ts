export const PANCAKE_WEBHOOK_QUEUE = 'pancake-webhook';
export const PANCAKE_WEBHOOK_JOB = 'ingest';
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
  requestId?: string;
  logId?: string;
}
