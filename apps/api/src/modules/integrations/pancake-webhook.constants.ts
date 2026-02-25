export const PANCAKE_WEBHOOK_QUEUE = 'pancake-webhook';
export const PANCAKE_WEBHOOK_JOB = 'ingest';

export interface PancakeWebhookJobData {
  logId: string;
  requestId: string;
  tenantId: string;
  payload: any;
}
