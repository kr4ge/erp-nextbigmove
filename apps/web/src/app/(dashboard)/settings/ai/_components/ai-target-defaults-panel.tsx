'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import {
  fetchTargetDefaults,
  saveTargetDefaults,
  type CreativeStoreTargetValues,
  type CreativeTargetDefaults,
} from '@/app/(dashboard)/creative-agent/video-registry/_services/creative-store-targets.service';

const EMPTY: CreativeStoreTargetValues = {
  hookRatePct: null,
  holdRatePct: null,
  ctrPct: null,
  breakevenCpp: null,
  cpp: null,
  scaleCpp: null,
  killCpp: null,
  arPct: null,
  scaleArPct: null,
  killArPct: null,
  maxCancellationPct: null,
  maxRtsPct: null,
  note: null,
};

type NumericKey = keyof Omit<CreativeStoreTargetValues, 'note'>;
type Field = { key: NumericKey; label: string; unit: '%' | '₱'; title: string };

const COST_FIELDS: Field[] = [
  { key: 'breakevenCpp', label: 'Break-even CPP', unit: '₱', title: 'Where an order stops making money. Not an ambition.' },
  { key: 'cpp', label: 'Target CPP', unit: '₱', title: 'What a good creative should achieve, comfortably below break-even.' },
  { key: 'arPct', label: 'Target AR%', unit: '%', title: 'Spend as a share of collected revenue. Lower is better.' },
];

const LIMIT_FIELDS: Field[] = [
  { key: 'maxCancellationPct', label: 'Max cancellation', unit: '%', title: 'Orders cancelled before shipping.' },
  { key: 'maxRtsPct', label: 'Max RTS', unit: '%', title: 'Parcels refused at the door.' },
  { key: 'hookRatePct', label: 'Min hook rate', unit: '%', title: '3-second plays over impressions. A floor.' },
];

const BAND_RATIOS = { scale: 0.75, kill: 1.3 };
const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

/**
 * The tenant's fallback creative targets.
 *
 * A tenant can run more than a hundred stores, and typing the same six numbers
 * into each is data entry rather than judgement. These are inherited by any
 * store that sets none of its own, and the analysis is told which figures were
 * inherited, so a fallback is never mistaken for a decision somebody made
 * about that store.
 */
export function AiTargetDefaultsPanel() {
  const { addToast } = useToast();
  const [data, setData] = useState<CreativeTargetDefaults | null>(null);
  const [draft, setDraft] = useState<CreativeStoreTargetValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchTargetDefaults();
      setData(result);
      setDraft(result.targets ? strip(result.targets) : EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the default targets.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const orderError = useMemo(() => bandOrderError(draft), [draft]);

  const save = async () => {
    if (orderError) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await saveTargetDefaults(draft);
      setData((current) => (current ? { ...current, ...updated } : current));
      setDraft(updated.targets ? strip(updated.targets) : EMPTY);
      setSaved(true);
      addToast('success', 'Default targets saved. Stores without their own now use these.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the default targets.');
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <section className="panel p-5">
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Loading default targets…</div>
      </section>
    );
  }

  const stored = data.targets ? strip(data.targets) : EMPTY;
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const canEdit = data.canEdit;
  const set = (key: NumericKey, raw: string) =>
    setDraft((current) => ({ ...current, [key]: raw === '' ? null : Number(raw) }));
  const learningBudget = draft.cpp && draft.cpp > 0 ? Math.round((draft.cpp * 50) / 7) : null;

  return (
    <section className="panel p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Default creative targets</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          What a winning creative looks like when a store has not decided for itself. A store that sets its own targets always overrides these, and the analysis is told which figures it inherited.
        </p>
      </div>

      <p className="mb-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft/30 px-3 py-2 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
        <span>
          <span className="font-medium text-foreground">{data.storesInheriting} store{data.storesInheriting === 1 ? '' : 's'}</span> currently inherit these figures.
          {data.storesWithOwnTargets > 0 ? <> <span className="font-medium text-foreground">{data.storesWithOwnTargets}</span> set their own and are unaffected.</> : null}
        </span>
      </p>

      {error ? <p className="mb-4 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="space-y-5">
        <fieldset className="space-y-2.5">
          <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">Cost &amp; efficiency</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COST_FIELDS.map((field) => (
              <div key={field.key}>
                <NumberField field={field} value={draft[field.key]} disabled={!canEdit} onChange={(raw) => set(field.key, raw)} />
                {field.key === 'cpp' ? <DerivedLines value={draft.cpp} format={peso} /> : null}
                {field.key === 'arPct' ? <DerivedLines value={draft.arPct} format={(value) => `${value}%`} /> : null}
              </div>
            ))}
          </div>
          {learningBudget ? (
            <p className="text-[11px] leading-relaxed text-muted">
              At this target, an ad set needs about <span className="font-medium tabular-nums text-foreground">{peso(learningBudget)} a day</span> to reach 50 purchases in a week and leave Meta&apos;s learning phase.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">Quality limits</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIMIT_FIELDS.map((field) => (
              <NumberField key={field.key} field={field} value={draft[field.key]} disabled={!canEdit} onChange={(raw) => set(field.key, raw)} />
            ))}
          </div>
          <p className="text-[11px] text-muted">Hold rate and link CTR are read from Meta and judged against platform norms.</p>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Note for the analysis</span>
          <input
            id="target-default-note"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint focus:border-primary disabled:opacity-60"
            value={draft.note ?? ''}
            placeholder="Optional. Where these numbers came from, so a reader knows."
            maxLength={500}
            disabled={!canEdit}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value || null }))}
          />
        </label>
      </div>

      {orderError ? <p className="mt-4 text-xs text-warning">{orderError}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
        {saved && !dirty ? <span className="mr-auto flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
        {data.targets?.updatedBy && !dirty && !saved ? (
          <span className="mr-auto text-xs text-muted">
            Set by {data.targets.updatedBy}
            {data.targets.updatedAt ? ` · ${new Date(data.targets.updatedAt).toLocaleDateString()}` : ''}
          </span>
        ) : null}
        {!canEdit ? <span className="mr-auto text-xs text-muted">Set by whoever manages creative performance.</span> : null}
        {canEdit ? <Button type="button" size="sm" loading={saving} disabled={!dirty || Boolean(orderError)} onClick={() => void save()}>Save defaults</Button> : null}
      </div>
    </section>
  );
}

function NumberField({ field, value, disabled, onChange }: {
  field: Field;
  value: number | null;
  disabled: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="block" title={field.title}>
      <span className="mb-1 block text-xs font-medium text-muted">{field.label}</span>
      <span className="flex h-10 items-center rounded-lg border border-border bg-background px-3 focus-within:border-primary">
        {field.unit === '₱' ? <span className="mr-1.5 text-sm text-muted">₱</span> : null}
        <input
          id={`target-default-${field.key}`}
          type="number"
          step="0.01"
          min={0}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-faint disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={value ?? ''}
          placeholder="—"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.unit === '%' ? <span className="ml-1.5 text-sm text-muted">%</span> : null}
      </span>
    </label>
  );
}

/** How the ERP reads the target: scale at 75%, kill at 130%. Shown, never hidden. */
function DerivedLines({ value, format }: { value: number | null; format: (value: number) => string }) {
  if (value == null || value <= 0) return null;
  return (
    <p className="mt-1 text-[11px] tabular-nums text-muted">
      scale below {format(Math.round(value * BAND_RATIOS.scale * 100) / 100)} · kill above {format(Math.round(value * BAND_RATIOS.kill * 100) / 100)}
    </p>
  );
}

/** The only order that can be wrong: a target at or above break-even loses money on every order. */
function bandOrderError(values: CreativeStoreTargetValues): string | null {
  if (values.cpp == null || values.breakevenCpp == null) return null;
  return values.cpp > values.breakevenCpp
    ? 'Target CPP must be at or below break-even, or every order it buys loses money.'
    : null;
}

function strip(values: CreativeStoreTargetValues & Record<string, unknown>): CreativeStoreTargetValues {
  return {
    hookRatePct: values.hookRatePct,
    holdRatePct: values.holdRatePct,
    ctrPct: values.ctrPct,
    breakevenCpp: values.breakevenCpp,
    cpp: values.cpp,
    scaleCpp: values.scaleCpp,
    killCpp: values.killCpp,
    arPct: values.arPct,
    scaleArPct: values.scaleArPct,
    killArPct: values.killArPct,
    maxCancellationPct: values.maxCancellationPct,
    maxRtsPct: values.maxRtsPct,
    note: values.note,
  };
}
