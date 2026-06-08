import type { TenantStatus } from './tenant';

export type PartnerIntegrationOverview = {
  partner: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    isOperational: boolean;
    maxIntegrations: number;
    integrationCount: number;
  };
  summary: {
    stores: number;
    activeStores: number;
    enabledStores: number;
    products: number;
    tags: number;
    posWarehouses: number;
    recentWebhookErrors: number;
  };
  webhook: {
    enabled: boolean;
    autoCancelEnabled: boolean;
    reconcileEnabled: boolean;
    reconcileIntervalSeconds: number;
    reconcileMode: 'incremental' | 'full_reset';
    hasApiKey: boolean;
    keyLast4: string | null;
    rotatedAt: string | null;
    webhookUrl: string;
    relayEnabled: boolean;
    relayWebhookUrl: string | null;
    relayHeaderKey: string | null;
    relayHasApiKey: boolean;
    relayKeyLast4: string | null;
    relayUpdatedAt: string | null;
  };
  stores: PartnerPosStoreIntegration[];
  recentWebhookLogs: PartnerWebhookLog[];
};

export type PartnerIntegrationActionResponse = {
  action: string;
  result: unknown;
  overview: PartnerIntegrationOverview;
};

export type BulkImportPartnerPosStoresInput = {
  integrations: Array<{ apiKey: string }>;
};

export type UpdatePartnerWebhookInput = {
  enabled?: boolean;
  autoCancelEnabled?: boolean;
  reconcileEnabled?: boolean;
  reconcileIntervalSeconds?: number;
  reconcileMode?: 'incremental' | 'full_reset';
};

export type UpdatePartnerWebhookRelayInput = {
  enabled: boolean;
  webhookUrl?: string;
  headerKey?: string;
  apiKey?: string;
};

export type UpdatePartnerPosStoreInput = {
  name?: string;
  shopName?: string;
  description?: string;
  status?: 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISABLED';
  enabled?: boolean;
  initialValueOffer?: number;
};

export type PartnerPosStoreIntegration = {
  id: string;
  name: string;
  storeName: string;
  shopName: string;
  shopId: string;
  shopAvatarUrl: string | null;
  description: string | null;
  status: string;
  enabled: boolean | null;
  initialValueOffer: number | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  tagCount: number;
  warehouseCount: number;
  integration: {
    id: string;
    name: string;
    provider: string;
    status: string;
    enabled: boolean;
    lastSyncAt: string | null;
    syncStatus: string | null;
    syncError: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type PartnerWebhookLog = {
  id: string;
  requestId: string;
  receiveStatus: string;
  processStatus: string;
  relayStatus: string | null;
  orderCount: number;
  orderRowsCount: number;
  upsertedCount: number;
  warningCount: number;
  errorMessage: string | null;
  receivedAt: string;
  totalDurationMs: number | null;
};
