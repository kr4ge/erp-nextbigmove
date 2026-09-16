'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Lock, Pencil, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreativeAiConfig, CreativeLens } from '../_types/creative-ai';

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
  onSave: (houseRules: string) => Promise<void> | void;
};

/**
 * The analysis prompt as the run dialog shows it: read-only by default, with
 * an edit affordance for whoever manages creative performance. The fixed
 * method and the status lens are not editable by anyone; only the house rules
 * are, which is what keeps results comparable between creatives.
 */
export function CreativeAiPromptPanel({ prompt, canEdit, saving, onSave }: Props) {
  const stored = prompt.houseRules ?? prompt.defaultHouseRules;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored);

  useEffect(() => {
    setDraft(prompt.houseRules ?? prompt.defaultHouseRules);
    setEditing(false);
  }, [prompt.houseRules, prompt.defaultHouseRules]);

  const usingDefault = prompt.houseRules === null;
  const dirty = draft !== stored;

  const save = async (value: string) => {
    await onSave(value);
    setEditing(false);
  };

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Analysis prompt</h3>
          <p className="mt-0.5 text-xs text-muted">
            {canEdit ? 'House rules are added to every analysis.' : 'Maintained by the advertising team.'}
          </p>
        </div>
        {canEdit && !editing ? (
          <Button type="button" size="sm" variant="outline" iconLeft={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
        {!canEdit ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-secondary px-2.5 py-1 text-xs font-medium text-muted">
            <Lock className="h-3 w-3" /> Read only
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="form-label">House rules</span>
            <span className="text-xs text-muted">{usingDefault ? 'Workspace default' : 'Customised'}</span>
          </div>
          <textarea
            className={`input mt-2 w-full resize-y font-mono text-xs leading-relaxed ${editing ? '' : 'cursor-default bg-background-secondary/60 text-muted'}`}
            rows={editing ? 8 : 5}
            maxLength={6000}
            value={draft}
            readOnly={!editing}
            aria-readonly={!editing}
            onChange={(event) => setDraft(event.target.value)}
          />
          {editing ? (
            <p className="mt-1.5 text-xs text-muted">
              Brand claims that are never allowed, mandatory disclaimers, price display rules, target audience, market facts. One rule per line.
            </p>
          ) : null}
        </div>

        {editing ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" loading={saving} disabled={!dirty} iconLeft={<Check className="h-3.5 w-3.5" />} onClick={() => void save(draft)}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              iconLeft={<X className="h-3.5 w-3.5" />}
              onClick={() => { setDraft(stored); setEditing(false); }}
            >
              Cancel
            </Button>
            {!usingDefault ? (
              <Button type="button" size="sm" variant="outline" disabled={saving} iconLeft={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => void save('')}>
                Reset to default
              </Button>
            ) : null}
          </div>
        ) : null}

        <details className="group rounded-lg border border-border bg-background-secondary/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-foreground">
            What else is in the prompt
            <ChevronDown className="h-3.5 w-3.5 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="space-y-2.5 border-t border-border p-3 text-xs">
            <p className="text-muted">
              Every run follows the same fixed method: read all sampled frames in order, then score the hook, story and pacing, message and offer, product and proof, call to action, and performance. Each claim must cite a timestamp or a named metric and is labelled observed, measured, or hypothesis.
            </p>
            <p className="text-muted">A lens is added automatically from the creative’s performance status:</p>
            <dl className="space-y-1.5">
              {(Object.keys(prompt.lenses) as CreativeLens[]).map((lens) => (
                <div key={lens} className="rounded-md bg-surface p-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-primary">{LENS_LABELS[lens]}</dt>
                  <dd className="mt-0.5 leading-relaxed text-muted">{prompt.lenses[lens]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      </div>
    </section>
  );
}
