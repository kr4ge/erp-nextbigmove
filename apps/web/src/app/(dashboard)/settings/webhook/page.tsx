'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, RefreshCcw, Webhook } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import apiClient from '@/lib/api-client';

type WebhookConfig = {
  enabled: boolean;
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

type WebhookLogOrder = {
  id: string;
  shopId: string | null;
  orderId: string | null;
  status: number | null;
  upsertStatus: string;
  reason: string | null;
  warning: string | null;
  createdAt: string;
};

type WebhookLogItem = {
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

type WebhookLogsResponse = {
  items: WebhookLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const parseErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (Array.isArray(data?.message) && data.message.length > 0) return data.message.join(', ');
  return error?.message || 'Request failed. Please try again.';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleString();
};

const maskApiKey = (key: string) => '•'.repeat(Math.max(12, key.length));

const toStatusBadgeClass = (status: string | null | undefined) => {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'PROCESSED' || normalized === 'ACCEPTED' || normalized === 'SUCCESS') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (normalized === 'QUEUED' || normalized === 'PROCESSING' || normalized === 'RECEIVED' || normalized === 'PARTIAL') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  if (normalized === 'SKIPPED') {
    return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
  if (!normalized) {
    return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
  return 'bg-rose-50 text-rose-700 ring-rose-200';
};

const formatDuration = (value?: number | null) => {
  if (value === null || value === undefined) return '--';
  if (!Number.isFinite(value)) return '--';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
};

export default function WebhookSettingsPage() {
  const { addToast } = useToast();
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingRelay, setIsUpdatingRelay] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [relayEnabled, setRelayEnabled] = useState(false);
  const [relayWebhookUrl, setRelayWebhookUrl] = useState('');
  const [relayHeaderKey, setRelayHeaderKey] = useState('x-api-key');
  const [relayApiKeyInput, setRelayApiKeyInput] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLogsResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit] = useState(10);
  const [logsReceiveStatus, setLogsReceiveStatus] = useState('');
  const [logsProcessStatus, setLogsProcessStatus] = useState('');
  const [logsRelayStatus, setLogsRelayStatus] = useState('');
  const [logsShopId, setLogsShopId] = useState('');
  const [logsOrderId, setLogsOrderId] = useState('');
  const [logsSearch, setLogsSearch] = useState('');
  const [logsStartDate, setLogsStartDate] = useState('');
  const [logsEndDate, setLogsEndDate] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const canRead = useMemo(
    () =>
      permissions.length === 0 ||
      permissions.includes('integration.webhook.read') ||
      permissions.includes('integration.webhook.update'),
    [permissions],
  );

  const canManage = useMemo(
    () => permissions.length === 0 || permissions.includes('integration.webhook.update'),
    [permissions],
  );

  const displayedApiKey = useMemo(() => {
    if (generatedApiKey) {
      return showApiKey ? generatedApiKey : maskApiKey(generatedApiKey);
    }
    if (config?.hasApiKey) {
      return `••••••••••••${config.keyLast4 || ''}`;
    }
    return 'No API key generated yet';
  }, [config?.hasApiKey, config?.keyLast4, generatedApiKey, showApiKey]);

  const fetchPermissions = async () => {
    try {
      if (typeof window !== 'undefined') {
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          const parsed = JSON.parse(cachedUser);
          if (Array.isArray(parsed?.permissions)) {
            setPermissions(parsed.permissions);
          }
        }
      }
    } catch {
      // ignore cache parsing
    }

    try {
      const res = await apiClient.get('/auth/permissions');
      const perms = Array.isArray(res?.data?.permissions) ? res.data.permissions : [];
      setPermissions(perms);
    } catch {
      // keep cached permissions
    }
  };

  const fetchWebhookConfig = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get('/integrations/pancake/webhook');
      setConfig(res.data);
      setRelayEnabled(!!res.data?.relayEnabled);
      setRelayWebhookUrl(res.data?.relayWebhookUrl || '');
      setRelayHeaderKey(res.data?.relayHeaderKey || 'x-api-key');
      setRelayApiKeyInput(res.data?.relayApiKey || '');
    } catch (error: any) {
      setErrorMessage(parseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookLogs = async () => {
    if (!canRead) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const params: Record<string, string | number> = {
        page: logsPage,
        limit: logsLimit,
      };
      if (logsReceiveStatus) params.receive_status = logsReceiveStatus;
      if (logsProcessStatus) params.process_status = logsProcessStatus;
      if (logsRelayStatus) params.relay_status = logsRelayStatus;
      if (logsShopId.trim()) params.shop_id = logsShopId.trim();
      if (logsOrderId.trim()) params.order_id = logsOrderId.trim();
      if (logsSearch.trim()) params.search = logsSearch.trim();
      if (logsStartDate) params.start_date = logsStartDate;
      if (logsEndDate) params.end_date = logsEndDate;

      const res = await apiClient.get<WebhookLogsResponse>('/integrations/pancake/webhook/logs', {
        params,
      });
      setLogs(res.data);
    } catch (error: any) {
      setLogsError(parseErrorMessage(error));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
    fetchWebhookConfig();
  }, []);

  useEffect(() => {
    setLogsPage(1);
  }, [
    logsReceiveStatus,
    logsProcessStatus,
    logsRelayStatus,
    logsShopId,
    logsOrderId,
    logsSearch,
    logsStartDate,
    logsEndDate,
  ]);

  useEffect(() => {
    fetchWebhookLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canRead,
    logsPage,
    logsLimit,
    logsReceiveStatus,
    logsProcessStatus,
    logsRelayStatus,
    logsShopId,
    logsOrderId,
    logsSearch,
    logsStartDate,
    logsEndDate,
  ]);

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      addToast('success', `${label} copied.`);
    } catch {
      addToast('error', `Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const handleRotate = async () => {
    setIsRotating(true);
    try {
      const res = await apiClient.post('/integrations/pancake/webhook/rotate-key');
      setConfig({
        enabled: !!res.data.enabled,
        hasApiKey: true,
        keyLast4: res.data.keyLast4 || null,
        rotatedAt: res.data.rotatedAt || null,
        rotatedByUserId: res.data.rotatedByUserId || null,
        headerKey: res.data.headerKey || 'x-api-key',
        webhookUrl: res.data.webhookUrl || config?.webhookUrl || '',
        relayEnabled: !!res.data.relayEnabled,
        relayWebhookUrl: res.data.relayWebhookUrl || null,
        relayApiKey: res.data.relayApiKey || null,
        relayHasApiKey: !!res.data.relayHasApiKey,
        relayKeyLast4: res.data.relayKeyLast4 || null,
        relayUpdatedAt: res.data.relayUpdatedAt || null,
        relayUpdatedByUserId: res.data.relayUpdatedByUserId || null,
        relayHeaderKey: res.data.relayHeaderKey || 'x-api-key',
      });
      setGeneratedApiKey(res.data.apiKey || '');
      setShowApiKey(false);
      setRelayHeaderKey(res.data.relayHeaderKey || 'x-api-key');
      setRelayApiKeyInput(res.data.relayApiKey || '');
      addToast('success', 'Webhook API key rotated.');
    } catch (error: any) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsRotating(false);
    }
  };

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    if (!config) return;
    setIsUpdating(true);
    try {
      const res = await apiClient.patch('/integrations/pancake/webhook', {
        enabled: nextEnabled,
      });
      setConfig(res.data);
      addToast('success', `Webhook ${res.data.enabled ? 'enabled' : 'disabled'}.`);
    } catch (error: any) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveRelay = async () => {
    setIsUpdatingRelay(true);
    try {
      const payload: Record<string, any> = {
        enabled: relayEnabled,
        webhookUrl: relayWebhookUrl.trim(),
        headerKey: relayHeaderKey.trim(),
      };
      if (relayApiKeyInput.trim()) {
        payload.apiKey = relayApiKeyInput.trim();
      }

      const res = await apiClient.patch('/integrations/pancake/webhook/relay', payload);
      setConfig(res.data);
      setRelayEnabled(!!res.data?.relayEnabled);
      setRelayWebhookUrl(res.data?.relayWebhookUrl || '');
      setRelayHeaderKey(res.data?.relayHeaderKey || 'x-api-key');
      setRelayApiKeyInput(res.data?.relayApiKey || '');
      addToast('success', 'Relay settings updated.');
    } catch (error: any) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdatingRelay(false);
    }
  };

  const handleToggleRelayEnabled = async (nextEnabled: boolean) => {
    setRelayEnabled(nextEnabled);
    setIsUpdatingRelay(true);
    try {
      const payload: Record<string, any> = {
        enabled: nextEnabled,
        webhookUrl: relayWebhookUrl.trim(),
        headerKey: relayHeaderKey.trim(),
      };
      if (relayApiKeyInput.trim()) {
        payload.apiKey = relayApiKeyInput.trim();
      }

      const res = await apiClient.patch('/integrations/pancake/webhook/relay', payload);
      setConfig(res.data);
      setRelayEnabled(!!res.data?.relayEnabled);
      setRelayWebhookUrl(res.data?.relayWebhookUrl || '');
      setRelayHeaderKey(res.data?.relayHeaderKey || 'x-api-key');
      setRelayApiKeyInput(res.data?.relayApiKey || '');
      addToast('success', `Relay ${res.data?.relayEnabled ? 'enabled' : 'disabled'}.`);
    } catch (error: any) {
      setRelayEnabled(!nextEnabled);
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdatingRelay(false);
    }
  };

  const logItems = logs?.items || [];
  const logsTotal = logs?.pagination?.total || 0;
  const logsTotalPages = logs?.pagination?.totalPages || 1;
  const logsStart = logsTotal === 0 ? 0 : (logsPage - 1) * logsLimit + 1;
  const logsEnd = Math.min(logsPage * logsLimit, logsTotal);

  return (
    <div className="space-y-6">
      {!canRead && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          You do not have permission to view webhook settings.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Card>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Webhook className="h-4 w-4" />
                Receive
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Pancake POS to ERP</h2>
              <p className="text-sm text-slate-600">
                Use this URL and API key in Pancake settings. This is shared across all shops in your tenant.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={config?.enabled ? 'ACTIVE' : 'DISABLED'} />
              <Button
                type="button"
                variant="outline"
                onClick={handleRotate}
                loading={isRotating}
                disabled={!canManage || loading || !config}
                iconLeft={<RefreshCcw className="h-4 w-4" />}
              >
                Rotate API Key
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Receive Webhook</p>
              <p className="text-xs text-slate-500">Accept Pancake webhook payloads for this tenant.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!config?.enabled}
              onClick={() => handleToggleEnabled(!config?.enabled)}
              disabled={!canManage || loading || !config || isUpdating}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                config?.enabled ? 'bg-blue-600' : 'bg-slate-300'
              } ${!canManage || loading || !config || isUpdating ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  config?.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <FormInput
                label="Webhook URL"
                value={config?.webhookUrl || ''}
                readOnly
                helper="Paste this in Pancake webhook URL."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(config?.webhookUrl || '', 'Webhook URL')}
                disabled={!config?.webhookUrl}
                iconLeft={<Copy className="h-4 w-4" />}
              >
                Copy URL
              </Button>
            </div>

            <div className="space-y-2">
              <FormInput
                label="Header Key"
                value={config?.headerKey || 'x-api-key'}
                readOnly
                helper="Use this header key in Pancake request headers."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(config?.headerKey || 'x-api-key', 'Header key')}
                iconLeft={<Copy className="h-4 w-4" />}
              >
                Copy Header Key
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">API Key</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  disabled={!generatedApiKey}
                  iconLeft={showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(generatedApiKey, 'API key')}
                  disabled={!generatedApiKey}
                  iconLeft={<Copy className="h-4 w-4" />}
                >
                  Copy API Key
                </Button>
              </div>
            </div>

            <FormInput
              value={displayedApiKey}
              readOnly
              helper={
                generatedApiKey
                  ? 'Copy and store this key now. It is only shown in full right after rotation.'
                  : config?.hasApiKey
                    ? 'Existing API key is hidden for security. Rotate to generate a new key.'
                    : 'Generate an API key first, then configure Pancake headers.'
              }
              className="font-mono"
            />

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="inline-flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                Last 4: <span className="font-semibold text-slate-700">{config?.keyLast4 || '--'}</span>
              </div>
              <div>
                Rotated at: <span className="font-semibold text-slate-700">{formatDateTime(config?.rotatedAt)}</span>
              </div>
              <div>
                Rotated by: <span className="font-semibold text-slate-700">{config?.rotatedByUserId || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Webhook className="h-4 w-4" />
                Send
              </div>
              <h2 className="text-xl font-semibold text-slate-900">ERP to External Webhook</h2>
              <p className="text-sm text-slate-600">
                Forward received Pancake payloads (unchanged JSON) to another platform webhook.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={relayEnabled ? 'ACTIVE' : 'DISABLED'} />
              <Button
                type="button"
                onClick={handleSaveRelay}
                loading={isUpdatingRelay}
                disabled={!canManage || loading}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">Send Relay</p>
              <p className="text-xs text-slate-500">
                Forward received payloads to your external webhook endpoint.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={relayEnabled}
              onClick={() => handleToggleRelayEnabled(!relayEnabled)}
              disabled={!canManage || loading || isUpdatingRelay}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                relayEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              } ${!canManage || loading || isUpdatingRelay ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  relayEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <FormInput
                label="Relay Webhook URL"
                value={relayWebhookUrl}
                onChange={(e) => setRelayWebhookUrl(e.target.value)}
                placeholder="https://your-other-system.com/webhook"
                helper="Target endpoint that will receive the same payload JSON."
              />
            </div>

            <div className="space-y-2">
              <FormInput
                label="Relay Header Key"
                value={relayHeaderKey}
                onChange={(e) => setRelayHeaderKey(e.target.value)}
                helper="Header name used when sending the relay API key to target webhook."
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#94A3B8]">
              Local `pos_orders` saving still runs even when relay delivery fails.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <FormInput
              label="Relay API Key"
              type="text"
              value={relayApiKeyInput}
              onChange={(e) => setRelayApiKeyInput(e.target.value)}
              placeholder="Enter target x-api-key"
              helper={
                config?.relayHasApiKey
                  ? 'This key is visible and editable.'
                  : 'API key used when forwarding payload to target webhook.'
              }
              disabled={!canManage || loading}
            />

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div>
                Last 4: <span className="font-semibold text-slate-700">{config?.relayKeyLast4 || '--'}</span>
              </div>
              <div>
                Updated at: <span className="font-semibold text-slate-700">{formatDateTime(config?.relayUpdatedAt)}</span>
              </div>
              <div>
                Updated by: <span className="font-semibold text-slate-700">{config?.relayUpdatedByUserId || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Webhook Logs</h2>
              <p className="text-sm text-slate-600">
                Monitor API receive status, processing status, duration, and per-order results.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchWebhookLogs}
              disabled={logsLoading || !canRead}
              iconLeft={<RefreshCcw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsReceiveStatus}
              onChange={(e) => setLogsReceiveStatus(e.target.value)}
            >
              <option value="">All Receive</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="AUTH_FAILED">AUTH_FAILED</option>
              <option value="DISABLED">DISABLED</option>
              <option value="INVALID_TENANT">INVALID_TENANT</option>
              <option value="FAILED">FAILED</option>
            </select>

            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsProcessStatus}
              onChange={(e) => setLogsProcessStatus(e.target.value)}
            >
              <option value="">All Process</option>
              <option value="QUEUED">QUEUED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="PROCESSED">PROCESSED</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="FAILED">FAILED</option>
              <option value="SKIPPED">SKIPPED</option>
            </select>

            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsRelayStatus}
              onChange={(e) => setLogsRelayStatus(e.target.value)}
            >
              <option value="">All Relay</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="SKIPPED">SKIPPED</option>
            </select>

            <input
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsShopId}
              onChange={(e) => setLogsShopId(e.target.value)}
              placeholder="Shop ID"
            />

            <input
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsOrderId}
              onChange={(e) => setLogsOrderId(e.target.value)}
              placeholder="Order ID"
            />

            <input
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsSearch}
              onChange={(e) => setLogsSearch(e.target.value)}
              placeholder="Search request/error"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <input
              type="date"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsStartDate}
              onChange={(e) => setLogsStartDate(e.target.value)}
            />
            <input
              type="date"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={logsEndDate}
              onChange={(e) => setLogsEndDate(e.target.value)}
            />
            <div className="lg:col-span-2 flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLogsReceiveStatus('');
                  setLogsProcessStatus('');
                  setLogsRelayStatus('');
                  setLogsShopId('');
                  setLogsOrderId('');
                  setLogsSearch('');
                  setLogsStartDate('');
                  setLogsEndDate('');
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>

          {logsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {logsError}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Received</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Request</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">API</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Process</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Relay</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Orders</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Error / Warning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsLoading ? (
                  <tr>
                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={8}>
                      Loading webhook logs...
                    </td>
                  </tr>
                ) : logItems.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={8}>
                      No webhook logs found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  logItems.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setExpandedLogId((prev) => (prev === row.id ? null : row.id))}
                      >
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {formatDateTime(row.receivedAt)}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          <div className="font-mono text-[11px] text-slate-900">{row.requestId}</div>
                          <div className="text-slate-500">job: {row.queueJobId || '--'}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toStatusBadgeClass(row.receiveStatus)}`}>
                            {row.receiveStatus}
                          </span>
                          <div className="text-slate-500 mt-1">{row.receiveHttpStatus ?? '--'}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toStatusBadgeClass(row.processStatus)}`}>
                            {row.processStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toStatusBadgeClass(row.relayStatus)}`}>
                            {row.relayStatus || 'SKIPPED'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <div>receive: {formatDuration(row.receiveDurationMs)}</div>
                          <div>process: {formatDuration(row.processingDurationMs)}</div>
                          <div className="font-semibold text-slate-900">total: {formatDuration(row.totalDurationMs)}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <div>rows: {row.orderRowsCount}</div>
                          <div>upserted: {row.upsertedCount}</div>
                          <div>warnings: {row.warningCount}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          <div className="font-semibold text-rose-700">{row.errorCode || '--'}</div>
                          <div className="text-slate-500 max-w-[340px] truncate">{row.errorMessage || '--'}</div>
                        </td>
                      </tr>
                      {expandedLogId === row.id && (
                        <tr key={`${row.id}-expanded`} className="bg-slate-50">
                          <td className="px-3 py-3" colSpan={8}>
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="mb-2 text-xs text-slate-500">
                                payload size: {row.payloadBytes ?? 0} bytes • attempts: {row.attempts}
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Shop ID</th>
                                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Order ID</th>
                                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Status</th>
                                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Result</th>
                                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Reason</th>
                                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Warning</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.orders.length > 0 ? (
                                      row.orders.map((order) => (
                                        <tr key={order.id}>
                                          <td className="px-2 py-2 text-xs text-slate-700">{order.shopId || '--'}</td>
                                          <td className="px-2 py-2 text-xs text-slate-700">{order.orderId || '--'}</td>
                                          <td className="px-2 py-2 text-xs text-slate-700">{order.status ?? '--'}</td>
                                          <td className="px-2 py-2 text-xs text-slate-700">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toStatusBadgeClass(order.upsertStatus)}`}>
                                              {order.upsertStatus}
                                            </span>
                                          </td>
                                          <td className="px-2 py-2 text-xs text-slate-700">{order.reason || '--'}</td>
                                          <td className="px-2 py-2 text-xs text-slate-500">{order.warning || '--'}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td className="px-2 py-3 text-xs text-slate-500" colSpan={6}>
                                          No per-order rows captured.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing {logsStart}-{logsEnd} of {logsTotal}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logsPage <= 1 || logsLoading}
                onClick={() => setLogsPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logsPage >= logsTotalPages || logsLoading}
                onClick={() => setLogsPage((prev) => Math.min(logsTotalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
