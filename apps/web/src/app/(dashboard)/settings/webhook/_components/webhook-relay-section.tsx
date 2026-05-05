'use client';

import { Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { StatusBadge } from '@/components/ui/status-badge';
import type { WebhookConfig } from '../_types/webhook';
import { formatWebhookDateTime } from '../_utils/webhook-formatters';

interface WebhookRelaySectionProps {
  config: WebhookConfig | null;
  loading: boolean;
  canManage: boolean;
  isUpdatingRelay: boolean;
  relayEnabled: boolean;
  relayWebhookUrl: string;
  relayHeaderKey: string;
  relayApiKeyInput: string;
  onSaveRelay: () => void;
  onToggleRelayEnabled: (nextEnabled: boolean) => void;
  onRelayWebhookUrlChange: (value: string) => void;
  onRelayHeaderKeyChange: (value: string) => void;
  onRelayApiKeyInputChange: (value: string) => void;
}

export function WebhookRelaySection({
  config,
  loading,
  canManage,
  isUpdatingRelay,
  relayEnabled,
  relayWebhookUrl,
  relayHeaderKey,
  relayApiKeyInput,
  onSaveRelay,
  onToggleRelayEnabled,
  onRelayWebhookUrlChange,
  onRelayHeaderKeyChange,
  onRelayApiKeyInputChange,
}: WebhookRelaySectionProps) {
  return (
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
              onClick={onSaveRelay}
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
            onClick={() => onToggleRelayEnabled(!relayEnabled)}
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
              onChange={(event) => onRelayWebhookUrlChange(event.target.value)}
              placeholder="https://your-other-system.com/webhook"
              helper="Target endpoint that will receive the same payload JSON."
            />
          </div>

          <div className="space-y-2">
            <FormInput
              label="Relay Header Key"
              value={relayHeaderKey}
              onChange={(event) => onRelayHeaderKeyChange(event.target.value)}
              helper="Header name used when sending the relay API key to target webhook."
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[#94A3B8]">
            Local `pos_orders` saving still runs even when relay delivery fails.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <FormInput
            label="Relay API Key"
            type="text"
            value={relayApiKeyInput}
            onChange={(event) => onRelayApiKeyInputChange(event.target.value)}
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
              Updated at:{' '}
              <span className="font-semibold text-slate-700">
                {formatWebhookDateTime(config?.relayUpdatedAt)}
              </span>
            </div>
            <div>
              Updated by:{' '}
              <span className="font-semibold text-slate-700">{config?.relayUpdatedByUserId || '--'}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
