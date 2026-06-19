'use client';

import { Button } from '@/components/ui/button';
import type { WebhookConfig } from '../_types/webhook';

interface WebhookReconcileSectionProps {
  config: WebhookConfig | null;
  canManage: boolean;
  loading: boolean;
  isUpdating: boolean;
  reconcileModeInput: 'incremental' | 'full_reset';
  reconcileIntervalSecondsInput: string;
  onToggleReconcileEnabled: (nextEnabled: boolean) => void;
  onReconcileModeChange: (value: 'incremental' | 'full_reset') => void;
  onReconcileIntervalSecondsChange: (value: string) => void;
  onSaveReconcileSettings: () => void;
  onToggleAutoCancelEnabled: (nextEnabled: boolean) => void;
}

export function WebhookReconcileSection({
  config,
  canManage,
  loading,
  isUpdating,
  reconcileModeInput,
  reconcileIntervalSecondsInput,
  onToggleReconcileEnabled,
  onReconcileModeChange,
  onReconcileIntervalSecondsChange,
  onSaveReconcileSettings,
  onToggleAutoCancelEnabled,
}: WebhookReconcileSectionProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-border dark:bg-surface">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Webhook Reconciliation Settings</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Configure auto-reconcile behavior for webhook-triggered updates.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!config?.reconcileEnabled}
            onClick={() => onToggleReconcileEnabled(!config?.reconcileEnabled)}
            disabled={!canManage || loading || !config || isUpdating}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
              config?.reconcileEnabled ? 'bg-amber-500' : 'bg-slate-300'
            } ${!canManage || loading || !config || isUpdating ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                config?.reconcileEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Reconcile Mode</label>
            <select
              value={reconcileModeInput}
              onChange={(event) =>
                onReconcileModeChange(
                  event.target.value === 'incremental' ? 'incremental' : 'full_reset',
                )
              }
              disabled={!canManage || loading || isUpdating}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground"
            >
              <option value="full_reset">Full Reset (same as manual reconcile)</option>
              <option value="incremental">Incremental (no day reset)</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              `full_reset` clears and rebuilds the day slice for maximum consistency.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Reconcile Interval (seconds)</label>
            <input
              type="number"
              min={10}
              max={3600}
              step={1}
              value={reconcileIntervalSecondsInput}
              onChange={(event) => onReconcileIntervalSecondsChange(event.target.value)}
              disabled={!canManage || loading || isUpdating}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground"
            />
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Delay before running tenant-wide reconcile for queued webhook dates.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onSaveReconcileSettings}
            disabled={!canManage || loading || isUpdating}
            loading={isUpdating}
          >
            Save Reconcile Settings
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-border dark:bg-background">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Auto Cancel Job</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Automatically enqueue status update to `6` when return-rate criteria are met.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!config?.autoCancelEnabled}
            onClick={() => onToggleAutoCancelEnabled(!config?.autoCancelEnabled)}
            disabled={!canManage || loading || !config || isUpdating}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
              config?.autoCancelEnabled ? 'bg-amber-500' : 'bg-slate-300'
            } ${!canManage || loading || !config || isUpdating ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                config?.autoCancelEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
    </div>
  );
}
