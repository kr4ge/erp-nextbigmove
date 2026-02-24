'use client';

import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    fetchPermissions();
    fetchWebhookConfig();
  }, []);

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
    </div>
  );
}
