'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchAllStoreTargets,
  saveStoreTargets,
  type CreativeStoreTargetValues,
  type CreativeStoreTargets,
} from '../_services/creative-store-targets.service';

const EMPTY: CreativeStoreTargetValues = {
  hookRatePct: null,
  holdRatePct: null,
  ctrPct: null,
  cpp: null,
  arPct: null,
  maxCancellationPct: null,
  maxRtsPct: null,
  note: null,
};

type NumericKey = keyof Omit<CreativeStoreTargetValues, 'note'>;
type Field = { key: NumericKey; label: string; unit: '%' | '₱'; title: string };

/** Two rows: what decides the verdict, then what explains it. */
const GROUPS: Array<{ caption: string; fields: Field[] }> = [
  {
    caption: 'Verdict',
    fields: [
      { key: 'cpp', label: 'Target CPP', unit: '₱', title: 'Cost per purchase ceiling' },
      { key: 'arPct', label: 'Target AR%', unit: '%', title: 'Spend as a share of collected revenue' },
      { key: 'maxCancellationPct', label: 'Max cancellation', unit: '%', title: 'Orders cancelled before shipping' },
      { key: 'maxRtsPct', label: 'Max RTS', unit: '%', title: 'Parcels refused at the door' },
    ],
  },
  {
    caption: 'Engagement',
    fields: [
      { key: 'hookRatePct', label: 'Hook rate', unit: '%', title: '3-second plays over impressions' },
      { key: 'holdRatePct', label: 'Hold rate', unit: '%', title: 'ThruPlays over 3-second plays' },
      { key: 'ctrPct', label: 'Link CTR', unit: '%', title: 'Link clicks over impressions' },
    ],
  },
];

/**
 * A store's target KPIs: what a winning creative looks like for it.
 *
 * Set once, read by every analysis of the store's creatives as prompt
 * variables. A blank field reaches the analysis as "not set"; without a target
 * CPP or AR% the verdict is "watch, no thresholds" rather than a guess.
 *
 * Looks the store up by either id, because the Stores page knows the POS store
 * and the enrollment dialog knows the creative config.
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load store targets.');
      setStore(null);
    }
  }, [posStoreId, storeConfigId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!store) return;
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">{store.name}</span>
        <span className="mx-2 text-border">·</span>
        <span className={store.isSet ? '' : 'text-warning'}>{status}</span>
      </p>

      {GROUPS.map((group) => (
        <fieldset key={group.caption} className="space-y-2.5">
          <legend className="text-[11px] font-medium uppercase tracking-wider text-muted">{group.caption}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.fields.map((field) => (
              <label key={field.key} className="block" title={field.title}>
                <span className="mb-1 block text-xs font-medium text-muted">{field.label}</span>
                <span className="flex h-10 items-center rounded-lg border border-border bg-background px-3 focus-within:border-primary">
                  {field.unit === '₱' ? <span className="mr-1.5 text-sm text-muted">₱</span> : null}
                  <input
                    id={`store-target-${field.key}`}
                    type="number"
                    step="0.01"
                    min={0}
                    className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-faint disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={draft[field.key] ?? ''}
                    placeholder="—"
                    disabled={!canEdit}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setDraft((current) => ({ ...current, [field.key]: raw === '' ? null : Number(raw) }));
                    }}
                  />
                  {field.unit === '%' ? <span className="ml-1.5 text-sm text-muted">%</span> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

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

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {saved && !dirty ? <span className="mr-auto flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
        {!canEdit ? <span className="mr-auto text-xs text-muted">Set by whoever manages creative performance.</span> : null}
        {onClose ? <Button type="button" variant="outline" size="sm" onClick={onClose}>{dirty ? 'Cancel' : 'Close'}</Button> : null}
        {canEdit ? <Button type="button" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>Save targets</Button> : null}
      </div>
    </div>
  );
}

function strip(values: CreativeStoreTargetValues & Record<string, unknown>): CreativeStoreTargetValues {
  return {
    hookRatePct: values.hookRatePct,
    holdRatePct: values.holdRatePct,
    ctrPct: values.ctrPct,
    cpp: values.cpp,
    arPct: values.arPct,
    maxCancellationPct: values.maxCancellationPct,
    maxRtsPct: values.maxRtsPct,
    note: values.note,
  };
}
