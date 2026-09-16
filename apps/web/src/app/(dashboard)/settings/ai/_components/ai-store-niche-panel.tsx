'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Lock, Pencil, Search, Store, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreativeAiConfig, CreativeAiStoreContext } from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

type Props = {
  niches: CreativeAiConfig['prompt']['niches'];
  stores: CreativeAiStoreContext[];
  canEdit: boolean;
  savingStoreId: string | null;
  onSave: (storeConfigId: string, input: { niche: string; storeRules: string }) => void;
};

/**
 * Each store gets a product category once; every analysis of that store's
 * creatives then carries the matching domain knowledge automatically. Nobody
 * picks a category per run, which is what keeps a perfume ad from being judged
 * by supplement rules.
 */
export function AiStoreNichePanel({ niches, stores, canEdit, savingStoreId, onSave }: Props) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNiche, setDraftNiche] = useState('');
  const [draftRules, setDraftRules] = useState('');

  const nicheLabel = useMemo(
    () => Object.fromEntries(niches.map((entry) => [entry.key, entry.label])) as Record<string, string>,
    [niches],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((store) =>
      store.name.toLowerCase().includes(needle)
      || store.codePrefix.toLowerCase().includes(needle)
      || (nicheLabel[store.niche] ?? '').toLowerCase().includes(needle));
  }, [nicheLabel, query, stores]);

  const assigned = stores.filter((store) => store.niche !== 'GENERAL_MERCHANDISE').length;

  const startEdit = (store: CreativeAiStoreContext) => {
    setEditingId(store.id);
    setDraftNiche(store.niche);
    setDraftRules(store.storeRules ?? '');
  };

  const selectedPack = niches.find((entry) => entry.key === draftNiche);

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <Store className="panel-icon" />
        <div className="min-w-0 flex-1">
          <h2 className="panel-title">Product categories by store</h2>
          <p className="mt-1 text-xs text-muted">
            Every analysis follows the same method, so scores stay comparable. The category adds what matters in that market: a perfume ad is judged on desire and occasion, a supplement ad on credibility and regulatory risk.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-background-secondary px-2.5 py-1 text-xs font-semibold text-muted">
          {assigned} of {stores.length} set
        </span>
      </div>

      <div className="space-y-3 p-5">
        {stores.length > 6 ? (
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="input w-full pl-9"
              placeholder="Search stores"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}

        <div className="divide-y divide-border rounded-xl border border-border">
          {filtered.map((store) => {
            const editing = editingId === store.id;
            const saving = savingStoreId === store.id;
            return (
              <article key={store.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{store.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      <code className="text-primary">{store.codePrefix}</code>
                      {' · '}
                      {nicheLabel[store.niche] ?? store.niche}
                      {store.storeRules ? ' · has store rules' : ''}
                    </p>
                  </div>
                  {canEdit && !editing ? (
                    <Button type="button" size="sm" variant="outline" iconLeft={<Pencil className="h-3.5 w-3.5" />} onClick={() => startEdit(store)}>
                      Edit
                    </Button>
                  ) : null}
                </div>

                {editing ? (
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="form-label">Product category</span>
                      <select className="input mt-1.5 w-full" value={draftNiche} onChange={(event) => setDraftNiche(event.target.value)}>
                        {niches.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
                      </select>
                      {selectedPack ? <span className="mt-1 block text-xs text-muted">{selectedPack.summary}</span> : null}
                    </label>

                    {selectedPack ? (
                      <details className="group rounded-lg border border-border bg-background-secondary/40">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-foreground">
                          What this category adds to the analysis
                          <ChevronDown className="h-3.5 w-3.5 text-muted transition group-open:rotate-180" />
                        </summary>
                        <div className="space-y-2.5 border-t border-border p-3 text-xs">
                          <p className="leading-relaxed text-muted">{selectedPack.whatMatters}</p>
                          <div>
                            <p className="font-semibold text-foreground">Examined specifically</p>
                            <ul className="mt-1 space-y-0.5 text-muted">
                              {selectedPack.lookFor.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Flagged for compliance review</p>
                            <ul className="mt-1 space-y-0.5 text-muted">
                              {selectedPack.complianceWatch.map((item) => <li key={item}>• {item}</li>)}
                            </ul>
                          </div>
                        </div>
                      </details>
                    ) : null}

                    <label className="block">
                      <span className="form-label">Rules for this store only</span>
                      <textarea
                        className="input mt-1.5 w-full resize-y font-mono text-xs leading-relaxed"
                        rows={4}
                        maxLength={4000}
                        placeholder="Brand positioning, claims this brand may never make, price or discount rules. One per line. Leave empty if none."
                        value={draftRules}
                        onChange={(event) => setDraftRules(event.target.value)}
                      />
                      <span className="mt-1 block text-xs text-muted">Added on top of the workspace house rules for this store&apos;s creatives only.</span>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" loading={saving} iconLeft={<Check className="h-3.5 w-3.5" />} onClick={() => { onSave(store.id, { niche: draftNiche, storeRules: draftRules }); setEditingId(null); }}>
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={saving} iconLeft={<X className="h-3.5 w-3.5" />} onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {!filtered.length ? <p className="p-4 text-sm text-muted">No stores match that search.</p> : null}
        </div>

        {!canEdit ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="h-3 w-3" /> Only users who manage creative performance can change these.
          </p>
        ) : null}
      </div>
    </section>
  );
}
