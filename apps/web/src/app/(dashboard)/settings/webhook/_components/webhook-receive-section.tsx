'use client';

import { Copy, Eye, EyeOff, KeyRound, RefreshCcw, Webhook } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import type { WebhookConfig } from '../_types/webhook';
import { formatWebhookDateTime } from '../_utils/webhook-formatters';

interface WebhookReceiveSectionProps {
  config: WebhookConfig | null;
  loading: boolean;
  canManage: boolean;
  canRotate: boolean;
  isUpdating: boolean;
  isRotating: boolean;
  displayedApiKey: string;
  generatedApiKey: string;
  showApiKey: boolean;
  onToggleShowApiKey: () => void;
  onCopy: (value: string, label: string) => void;
  onRotate: () => void;
  onToggleEnabled: (nextEnabled: boolean) => void;
}

export function WebhookReceiveSection({
  config,
  loading,
  canManage,
  canRotate,
  isUpdating,
  isRotating,
  displayedApiKey,
  generatedApiKey,
  showApiKey,
  onToggleShowApiKey,
  onCopy,
  onRotate,
  onToggleEnabled,
}: WebhookReceiveSectionProps) {
  return (
    <Card>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-1 text-xs font-semibold text-primary">
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
              onClick={onRotate}
              loading={isRotating}
              disabled={!canRotate || loading || !config}
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
            onClick={() => onToggleEnabled(!config?.enabled)}
            disabled={!canManage || loading || !config || isUpdating}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              config?.enabled ? 'bg-primary' : 'bg-slate-300'
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
              onClick={() => onCopy(config?.webhookUrl || '', 'Webhook URL')}
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
              onClick={() => onCopy(config?.headerKey || 'x-api-key', 'Header key')}
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
                onClick={onToggleShowApiKey}
                disabled={!generatedApiKey}
                iconLeft={showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCopy(generatedApiKey, 'API key')}
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
              Rotated at: <span className="font-semibold text-slate-700">{formatWebhookDateTime(config?.rotatedAt)}</span>
            </div>
            <div>
              Rotated by: <span className="font-semibold text-slate-700">{config?.rotatedByUserId || '--'}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
