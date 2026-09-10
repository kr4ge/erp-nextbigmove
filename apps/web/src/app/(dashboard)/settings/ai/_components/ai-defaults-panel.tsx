'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  CreativeAiConfig,
  CreativeAiEffort,
  CreativeAiProvider,
  UpdateCreativeAiConfigInput,
} from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

const EFFORT_OPTIONS: Array<{ value: CreativeAiEffort; label: string; help: string }> = [
  { value: 'LOW', label: 'Fast', help: 'Quick checks' },
  { value: 'MEDIUM', label: 'Balanced', help: 'Recommended' },
  { value: 'HIGH', label: 'Deep', help: 'Careful analysis' },
  { value: 'XHIGH', label: 'Very deep', help: 'Complex decisions' },
  { value: 'MAX', label: 'Maximum', help: 'Longest analysis' },
];

type Props = {
  config: CreativeAiConfig;
  draft: UpdateCreativeAiConfigInput;
  saving: boolean;
  onDraftChange: (next: UpdateCreativeAiConfigInput) => void;
  onProviderChange: (provider: CreativeAiProvider) => void;
  onModelChange: (provider: CreativeAiProvider, model: string) => void;
  onEffortChange: (effort: CreativeAiEffort) => void;
  onSave: () => void;
};

export function AiDefaultsPanel({ config, draft, saving, onDraftChange, onProviderChange, onModelChange, onEffortChange, onSave }: Props) {
  const selected = config.providers.find((entry) => entry.provider === draft.defaultProvider);
  const model = draft.defaultProvider === 'CLAUDE' ? draft.claudeModel : draft.codexModel;
  const selectedModel = selected?.models.find((entry) => entry.id === model);
  const efforts = selectedModel?.supportedEfforts ?? EFFORT_OPTIONS.map((entry) => entry.value);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header"><SlidersHorizontal className="panel-icon" /><div><h2 className="panel-title">Workspace defaults</h2><p className="mt-1 text-xs text-muted">Used automatically when someone starts a video analysis.</p></div></div>
      <div className="space-y-5 p-5">
        <fieldset>
          <legend className="form-label">Default AI</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {config.providers.map((provider) => (
              <button
                key={provider.provider}
                type="button"
                aria-pressed={draft.defaultProvider === provider.provider}
                disabled={!provider.available || !provider.connected}
                className={`rounded-xl border p-4 text-left transition ${draft.defaultProvider === provider.provider ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-primary/40'} disabled:cursor-not-allowed disabled:opacity-50`}
                onClick={() => onProviderChange(provider.provider)}
              >
                <span className="block font-semibold text-foreground">{provider.provider === 'CLAUDE' ? 'Claude' : 'Codex'}</span>
                <span className="mt-1 block text-xs text-muted">{provider.connected ? 'Ready to use' : 'Connect this provider first'}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="form-label">Default model</span>
            <select className="input mt-2 w-full" value={model} onChange={(event) => onModelChange(draft.defaultProvider, event.target.value)}>
              {(selected?.models ?? []).map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">Thinking level</span>
            <select className="input mt-2 w-full" value={draft.defaultEffort} onChange={(event) => onEffortChange(event.target.value as CreativeAiEffort)}>
              {EFFORT_OPTIONS.filter((entry) => efforts.includes(entry.value)).map((entry) => <option key={entry.value} value={entry.value}>{entry.label} — {entry.help}</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-background-secondary/30 p-4">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={draft.allowRunOverrides} onChange={(event) => onDraftChange({ ...draft, allowRunOverrides: event.target.checked })} />
          <span><span className="block text-sm font-semibold text-foreground">Let users choose per analysis</span><span className="mt-1 block text-xs text-muted">Creators can switch AI, model, or thinking level before they start. Turn this off for one consistent workspace setup.</span></span>
        </label>

        <details className="group rounded-xl border border-border bg-background-secondary/30">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground">
            Advanced limits
            <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            <label><span className="form-label">Maximum agent turns</span><input className="input mt-2 w-full" type="number" min={1} max={100} value={draft.maxTurns} onChange={(event) => onDraftChange({ ...draft, maxTurns: Number(event.target.value) })} /><span className="mt-1 block text-xs text-muted">Stops unusually long analysis loops.</span></label>
            <label><span className="form-label">Maximum cost per run (USD)</span><input className="input mt-2 w-full" type="number" min={0.01} max={100} step={0.01} value={draft.maxBudgetUsd} onChange={(event) => onDraftChange({ ...draft, maxBudgetUsd: Number(event.target.value) })} /><span className="mt-1 block text-xs text-muted">A safety cap, not a target.</span></label>
          </div>
        </details>

        <div className="flex justify-end"><Button type="button" loading={saving} onClick={onSave}>Save defaults</Button></div>
      </div>
    </section>
  );
}
