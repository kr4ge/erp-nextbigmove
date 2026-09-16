'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreativeAiConfig, CreativeLens } from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

const LENS_LABELS: Record<CreativeLens, string> = {
  DRAFT: 'Draft · launch readiness',
  LIVE: 'Live · what to change this week',
  WINNER: 'Winner · protect and scale',
  FATIGUED: 'Fatigued · diagnose and refresh',
  RETIRED: 'Retired · post-mortem',
};

type Props = {
  prompt: CreativeAiConfig['prompt'];
  canEdit: boolean;
  saving: boolean;
  onSave: (houseRules: string) => void;
};

export function AiHouseRulesPanel({ prompt, canEdit, saving, onSave }: Props) {
  const [draft, setDraft] = useState(prompt.houseRules ?? prompt.defaultHouseRules);
  useEffect(() => { setDraft(prompt.houseRules ?? prompt.defaultHouseRules); }, [prompt.houseRules, prompt.defaultHouseRules]);

  const usingDefault = prompt.houseRules === null;
  const dirty = draft !== (prompt.houseRules ?? prompt.defaultHouseRules);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <FileText className="panel-icon" />
        <div>
          <h2 className="panel-title">Analysis prompt</h2>
          <p className="mt-1 text-xs text-muted">The method every video analysis follows is fixed. The advertising team maintains the house rules below; they are appended to every run.</p>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label className="form-label" htmlFor="ai-house-rules">House rules</label>
            <span className="text-xs text-muted">{usingDefault ? 'Using the built-in default' : 'Customised for this tenant'}</span>
          </div>
          <textarea
            id="ai-house-rules"
            className="input mt-2 w-full resize-y font-mono text-[13px] leading-relaxed"
            rows={9}
            maxLength={6000}
            value={draft}
            disabled={!canEdit}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            {canEdit
              ? 'Brand claims that are never allowed, mandatory disclaimers, price display rules, target audience, market facts. One rule per line.'
              : 'Only users who manage creative performance (the advertising team) can edit these rules.'}
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              iconLeft={<RotateCcw className="h-4 w-4" />}
              disabled={saving || usingDefault}
              onClick={() => onSave('')}
            >
              Reset to default
            </Button>
            <Button type="button" loading={saving} disabled={!dirty} onClick={() => onSave(draft)}>Save house rules</Button>
          </div>
        ) : null}

        <details className="group rounded-xl border border-border bg-background-secondary/30">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-foreground">
            How the lens is chosen
            <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="space-y-3 border-t border-border p-4 text-sm">
            <p className="text-muted">Every run is judged on the same six categories. What changes is the lens, taken from the creative’s performance status at the time of the run:</p>
            <dl className="space-y-2">
              {(Object.keys(prompt.lenses) as CreativeLens[]).map((lens) => (
                <div key={lens} className="rounded-lg bg-surface p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-primary">{LENS_LABELS[lens]}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-muted">{prompt.lenses[lens]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      </div>
    </section>
  );
}
