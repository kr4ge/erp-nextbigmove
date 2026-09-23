'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchAllStoreTargets,
  fetchDerivedBreakeven,
  saveStoreTargets,
  type CreativeStoreTargetValues,
  type CreativeStoreTargets,
  type DerivedBreakeven,
} from '../_services/creative-store-targets.service';

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

/**
 * A store's target KPIs: what a winning creative looks like for it.
 *
 * Six numbers, because the person setting them should not have to do
 * arithmetic the ERP can do. A target implies its own scale and kill lines,
 * derived at 75% and 130% and shown under the field, so the analysis still
 * judges against four bands while the form asks for one number.
 *
 * Break-even is the exception and is asked for directly: it comes from the
 * store's economics rather than from ambition, the Performance page uses it as
 * its working ceiling, and the ERP offers its own derived figure beside it.
 *
 * A blank field reaches the analysis as "not set"; without a target CPP or AR%
 * the verdict is "watch, no thresholds" rather than a guess.
 */
export function CreativeStoreTargetsPanel({
  posStoreId,
  storeConfigId,
  canEdit,
  onClose,
}: {
  posStoreId?: string | null;
  storeConfigId?: string | null;
  canEdit: boolean;
  /** When given, the action row offers Cancel beside Save. */
  onClose?: () => void;
}) {
  const [store, setStore] = useState<CreativeStoreTargets | null | undefined>(undefined);
  const [draft, setDraft] = useState<CreativeStoreTargetValues>(EMPTY);
  const [derived, setDerived] = useState<DerivedBreakeven | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await fetchAllStoreTargets();
      const match =
        all.find((entry) => (storeConfigId ? entry.storeConfigId === storeConfigId : false)) ??
        all.find((entry) => (posStoreId ? entry.posStoreId === posStoreId : false)) ??
        null;
      setStore(match);
      setDraft(match?.targets ? strip(match.targets) : EMPTY);
      if (match) void fetchDerivedBreakeven(match.storeConfigId).then(setDerived);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load store targets.');
      setStore(null);
    }
  }, [posStoreId, storeConfigId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderError = useMemo(() => bandOrderError(draft), [draft]);

  const save = async () => {
    if (!store || orderError) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await saveStoreTargets(store.storeConfigId, draft);
      setStore(updated);
      setDraft(updated.targets ? strip(updated.targets) : EMPTY);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the store targets.');
    } finally {
      setSaving(false);
    }
  };

  if (store === undefined) {
    return <div className="flex items-center gap-2 py-6 text-sm text-muted"><Spinner /> Loading…</div>;
  }
  if (store === null) {
    return (
      <p className="py-4 text-sm text-muted">
        {error ?? 'No creatives are enrolled for this store yet, so there is nothing to set targets for.'}
      </p>
    );
  }

  const stored = store.targets ? strip(store.targets) : EMPTY;
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const status = store.isSet
    ? `Set${store.targets?.updatedBy ? ` by ${store.targets.updatedBy}` : ''}${store.targets?.updatedAt ? ` · ${new Date(store.targets.updatedAt).toLocaleDateString()}` : ''}`
    : 'Not set';
  const set = (key: NumericKey, raw: string) =>
    setDraft((current) => ({ ...current, [key]: raw === '' ? null : Number(raw) }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">{store.name}</span>
        <span className="mx-2 text-border">·</span>
        <span className={store.isSet ? '' : 'text-warning'}>{status}</span>
      </p>

      <fieldset className="space-y-2.5">
        <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">Cost &amp; efficiency</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COST_FIELDS.map((field) => (
            <div key={field.key}>
              <NumberField field={field} value={draft[field.key]} disabled={!canEdit} onChange={(raw) => set(field.key, raw)} />
              {field.key === 'cpp' ? <DerivedLines value={draft.cpp} format={peso} /> : null}
              {field.key === 'arPct' ? <DerivedLines value={draft.arPct} format={(value) => `${value}%`} /> : null}
              {field.key === 'breakevenCpp' && derived?.breakevenCpp != null ? (
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  {derived.deliveredOrders} delivered in {derived.days} days suggests {peso(Math.round(derived.breakevenCpp))}.
                  {canEdit ? (
                    <button type="button" className="ml-1 font-medium text-primary hover:underline" onClick={() => setDraft((current) => ({ ...current, breakevenCpp: Math.round(derived.breakevenCpp!) }))}>
                      Use it
                    </button>
                  ) : null}
                </p>
              ) : null}
            </div>
          ))}
        </div>
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
          id="store-target-note"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint focus:border-primary disabled:opacity-60"
          value={draft.note ?? ''}
          placeholder="Optional"
          maxLength={500}
          disabled={!canEdit}
          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value || null }))}
        />
      </label>

      <p className="text-xs text-muted">A blank field is reported to the analysis as not set.</p>

      {orderError ? <p className="text-xs text-warning">{orderError}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {saved && !dirty ? <span className="mr-auto flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
        {!canEdit ? <span className="mr-auto text-xs text-muted">Set by whoever manages creative performance.</span> : null}
        {onClose ? <Button type="button" variant="outline" size="sm" onClick={onClose}>{dirty ? 'Cancel' : 'Close'}</Button> : null}
        {canEdit ? <Button type="button" size="sm" loading={saving} disabled={!dirty || Boolean(orderError)} onClick={() => void save()}>Save targets</Button> : null}
      </div>
    </div>
  );
}

const COST_FIELDS: Field[] = [
  { key: 'breakevenCpp', label: 'Break-even CPP', unit: '₱', title: 'Where an order stops making money. Not an ambition: it is the line the Performance page uses as its ceiling.' },
  { key: 'cpp', label: 'Target CPP', unit: '₱', title: 'What a good creative should achieve, comfortably below break-even.' },
  { key: 'arPct', label: 'Target AR%', unit: '%', title: 'Spend as a share of collected revenue. Lower is better.' },
];

const LIMIT_FIELDS: Field[] = [
  { key: 'maxCancellationPct', label: 'Max cancellation', unit: '%', title: 'Orders cancelled before shipping. Above this is an audience-quality failure.' },
  { key: 'maxRtsPct', label: 'Max RTS', unit: '%', title: 'Parcels refused at the door. Above this is an audience-quality failure.' },
  { key: 'hookRatePct', label: 'Min hook rate', unit: '%', title: '3-second plays over impressions. A floor: above it is good.' },
];

const peso = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;

/** How the ERP reads the target: scale at 75%, kill at 130%. Shown, never hidden. */
const BAND_RATIOS = { scale: 0.75, kill: 1.3 };

function DerivedLines({ value, format }: { value: number | null; format: (value: number) => string }) {
  if (value == null || value <= 0) return null;
  return (
    <p className="mt-1 text-[11px] tabular-nums text-muted">
      scale below {format(Math.round(value * BAND_RATIOS.scale * 100) / 100)} · kill above {format(Math.round(value * BAND_RATIOS.kill * 100) / 100)}
    </p>
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
          id={`store-target-${field.key}`}
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

/**
 * The only order that can be wrong now: a target at or above break-even means
 * every order it buys loses money.
 */
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
