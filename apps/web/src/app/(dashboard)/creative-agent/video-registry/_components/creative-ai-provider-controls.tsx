'use client';

import Link from 'next/link';
import { AlertTriangle, Bot, Sparkles } from 'lucide-react';
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
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Checking AI connection…</p>
      </section>
    );
  }

  const modelLabel = models.find((entry) => entry.id === model)?.label || model;

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            {provider === 'CLAUDE' ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">AI engine</h3>
            <p className="mt-0.5 truncate text-xs text-muted">{modelLabel} · {EFFORT_LABELS[effort].label}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${connected ? 'bg-success-soft/50 text-success' : 'bg-warning-soft/60 text-warning'}`}>
          {connected ? 'Ready' : 'Not connected'}
        </span>
      </div>

      <div className="space-y-4 p-4">
        {canOverride ? (
          <>
            <fieldset>
              <legend className="form-label">Provider</legend>
              {/* Two across on every width: these are short labels and the
                  column is narrow, so a single row wastes no space. */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['CLAUDE', 'CODEX'] as const).map((key) => {
                  const status = providers.find((entry) => entry.provider === key);
                  const disabled = !status?.available;
                  const active = provider === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      aria-pressed={active}
                      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition ${active ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/40'} disabled:cursor-not-allowed disabled:opacity-50`}
                      onClick={() => onProviderChange(key)}
                    >
                      <span className="text-sm font-semibold text-foreground">{key === 'CLAUDE' ? 'Claude' : 'Codex'}</span>
                      <span className="text-xs leading-tight text-muted">
                        {disabled ? 'Not installed' : status?.connected ? 'Connected' : 'Needs connection'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Stacked by default so neither select is squeezed in the narrow
                sidebar; side by side once the dialog is wide enough. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="min-w-0">
                <span className="form-label">Model</span>
                <select className="input mt-1.5 w-full" value={model} onChange={(event) => onModelChange(event.target.value)}>
                  {models.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </select>
              </label>
              <label className="min-w-0">
                <span className="form-label">Thinking level</span>
                <select className="input mt-1.5 w-full" value={effort} onChange={(event) => onEffortChange(event.target.value as CreativeAiEffort)}>
                  {efforts.map((entry) => <option key={entry} value={entry}>{EFFORT_LABELS[entry].label}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs leading-relaxed text-muted">{EFFORT_LABELS[effort].help}. Deeper levels take longer.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Your workspace uses the administrator’s recommended AI settings.</p>
        )}

        {!connected ? (
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft/40 p-3 text-xs leading-relaxed text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {providerMessage || 'This AI provider is not connected.'}{' '}
              {canConfigure ? <Link href="/settings/ai" className="font-semibold underline">Open AI settings</Link> : 'Ask your administrator to connect it.'}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
