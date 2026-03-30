export type WebhookConfig = {
  enabled: boolean;
  autoCancelEnabled: boolean;
  reconcileEnabled: boolean;
  reconcileIntervalSeconds: number;
  reconcileMode: 'incremental' | 'full_reset';
  hasApiKey: boolean;
  keyLast4: string | null;
  rotatedAt: string | null;
  rotatedByUserId: string | null;
  headerKey: string;
  webhookUrl: string;
  relayEnabled: boolean;
  relayWebhookUrl: string | null;
  relayApiKey: string | null;
  relayHasApiKey: boolean;
  relayKeyLast4: string | null;
  relayUpdatedAt: string | null;
  relayUpdatedByUserId: string | null;
  relayHeaderKey: string;
};

export type WebhookLogOrder = {
  id: string;
  shopId: string | null;
  orderId: string | null;
  status: number | null;
  upsertStatus: string;
  reason: string | null;
  warning: string | null;
  createdAt: string;
};

export type WebhookLogItem = {
  id: string;
  requestTenantId: string | null;
  requestId: string;
  source: string;
  receiveHttpStatus: number | null;
  receiveStatus: string;
  processStatus: string;
  relayStatus: string | null;
  payloadHash: string | null;
  payloadBytes: number | null;
  orderCount: number;
  upsertedCount: number;
  warningCount: number;
  reconcileQueuedCount: number;
  reconcileSkippedCount: number;
  attempts: number;
  queueJobId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  receiveDurationMs: number | null;
  processingDurationMs: number | null;
  totalDurationMs: number | null;
  receivedAt: string;
  processingStartedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orderRowsCount: number;
  orders: WebhookLogOrder[];
};

export type WebhookLogsResponse = {
  items: WebhookLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type WebhookLogsFilters = {
  receiveStatus: string;
  processStatus: string;
  relayStatus: string;
  shopId: string;
  orderId: string;
  search: string;
  startDate: string;
  endDate: string;
};
