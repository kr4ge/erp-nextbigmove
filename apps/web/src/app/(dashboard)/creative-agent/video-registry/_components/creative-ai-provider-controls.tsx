'use client';

import Link from 'next/link';
import { AlertTriangle, Bot, ChevronDown, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { CreativeAiEffort, CreativeAiProvider } from '../_types/creative-ai';

const EFFORT_LABELS: Record<CreativeAiEffort, { label: string; help: string }> = {
  LOW: { label: 'Fast', help: 'Quick review with lighter reasoning' },
  MEDIUM: { label: 'Balanced', help: 'Best default for most creative reviews' },
  HIGH: { label: 'Deep', help: 'More careful analysis and recommendations' },
  XHIGH: { label: 'Very deep', help: 'For difficult or high-value decisions' },
  MAX: { label: 'Maximum', help: 'Most thorough; takes longer' },
};

type Props = {
  configLoaded: boolean;
  provider: CreativeAiProvider;
  model: string;
  effort: CreativeAiEffort;
  canOverride: boolean;
  canConfigure: boolean;
  connected: boolean;
  providerMessage?: string;
  providers: Array<{ provider: CreativeAiProvider; available: boolean; connected: boolean }>;
  models: Array<{ id: string; label: string }>;
  efforts: CreativeAiEffort[];
  onProviderChange: (provider: CreativeAiProvider) => void;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: CreativeAiEffort) => void;
};

export function CreativeAiProviderControls({
  configLoaded,
  provider,
  model,
  effort,
  canOverride,
  canConfigure,
  connected,
  providerMessage,
  providers,
  models,
  efforts,
  onProviderChange,
  onModelChange,
  onEffortChange,
}: Props) {
  if (!configLoaded) {
    return <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Checking AI connection…</p>;
  }

  const selectedModel = models.find((entry) => entry.id === model)?.label || model;

  return (
    <details className="group rounded-xl border border-border bg-background-secondary/30">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface text-primary shadow-sm">
          {provider === 'CLAUDE' ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">AI engine</span>
          <span className="block truncate text-xs text-muted">
            {provider === 'CLAUDE' ? 'Claude' : 'Codex'} · {selectedModel} · {EFFORT_LABELS[effort].label}
          </span>
        </span>
        <span className={`pill px-2 py-1 text-xs font-semibold ${connected ? 'border-success/30 bg-success-soft/30 text-success' : 'border-warning/30 bg-warning-soft/40 text-warning'}`}>
          {connected ? 'Ready' : 'Not connected'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-border px-4 py-4">
        {canOverride ? (
          <>
            <fieldset>
              <legend className="form-label">Choose AI</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['CLAUDE', 'CODEX'] as const).map((key) => {
                  const status = providers.find((entry) => entry.provider === key);
                  const disabled = !status?.available;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      aria-pressed={provider === key}
                      className={`rounded-xl border px-3 py-3 text-left transition ${provider === key ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/40'} disabled:cursor-not-allowed disabled:opacity-50`}
                      onClick={() => onProviderChange(key)}
                    >
                      <span className="block text-sm font-semibold text-foreground">{key === 'CLAUDE' ? 'Claude' : 'Codex'}</span>
                      <span className="mt-1 block text-xs text-muted">{disabled ? 'Not installed' : status?.connected ? 'Connected' : 'Needs connection'}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="form-label">Model</span>
                <select className="input mt-2 w-full" value={model} onChange={(event) => onModelChange(event.target.value)}>
                  {models.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </select>
              </label>
              <label>
                <span className="form-label">Thinking level</span>
                <select className="input mt-2 w-full" value={effort} onChange={(event) => onEffortChange(event.target.value as CreativeAiEffort)}>
                  {efforts.map((entry) => <option key={entry} value={entry}>{EFFORT_LABELS[entry].label}</option>)}
                </select>
                <span className="mt-1 block text-xs text-muted">{EFFORT_LABELS[effort].help}</span>
              </label>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Your workspace uses the administrator’s recommended AI settings.</p>
        )}

        {!connected ? (
          <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {providerMessage || 'This AI provider is not connected.'}{' '}
              {canConfigure ? <Link href="/settings/ai" className="font-semibold underline">Open AI settings</Link> : 'Ask your administrator to connect it.'}
            </span>
          </div>
        ) : null}
      </div>
    </details>
  );
}
