'use client';

import { useEffect, useState } from 'react';
import { Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchCreativeLinkTargets } from '../_services/video-registry.service';
import type { CreativeLinkTarget, LinkCreativeAliasInput, UnregisteredMetaCreative } from '../_types/video-registry';

type Props = {
  item: UnregisteredMetaCreative | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: LinkCreativeAliasInput) => Promise<void>;
};

export function LinkVideoDialog({ item, isSaving, onClose, onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [results, setResults] = useState<CreativeLinkTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberAlias, setRememberAlias] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setQuery('');
    setSelectedId('');
    setResults([]);
    setRememberAlias(false);
    setError(null);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const targets = await fetchCreativeLinkTargets(query);
        if (active) setResults(targets);
      } catch (loadError) {
        if (active) {
          setResults([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load creatives for linking.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [item, query]);

  const submit = async () => {
    if (!item || !selectedId) return setError('Select the creative this Meta ad belongs to.');
    setError(null);
    try {
      await onSubmit({
        unregisteredKey: item.key,
        creativeId: selectedId,
        ...(rememberAlias ? { alias: item.code ?? item.adName } : {}),
        accountId: item.accountId,
        adId: item.adId,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to link this Meta ad.');
    }
  };

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Meta ad to a creative</DialogTitle>
          <DialogDescription>
            Add Ad ID <code className="font-semibold text-foreground">{item?.adId}</code> to an existing creative. Its older linked ads and historical metrics stay intact.
          </DialogDescription>
        </DialogHeader>
        <label className="relative mt-5 block">
          <span className="sr-only">Search registered creatives</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="input w-full pl-9" placeholder="Search by title, code, or store" />
        </label>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto" role="radiogroup" aria-label="Registered creatives">
          {isLoading ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">Searching creatives…</p>
          ) : results.length ? results.map((creative) => (
            <label key={creative.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${selectedId === creative.id ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-background-secondary'}`}>
              <input type="radio" name="registry-creative" value={creative.id} checked={selectedId === creative.id} onChange={() => setSelectedId(creative.id)} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{creative.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  <code className="font-semibold text-primary">{creative.code}</code> · {creative.storeName} · {creative.linkedAdsCount === 1 ? '1 linked ad' : `${creative.linkedAdsCount} linked ads`}
                </span>
              </span>
            </label>
          )) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              No creatives match this search.
            </p>
          )}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background-secondary p-3">
          <input
            type="checkbox"
            checked={rememberAlias}
            onChange={(event) => setRememberAlias(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">Remember this ad name for future reposts</span>
            <span className="mt-1 block text-xs text-muted">
              Optional. Future ads with the exact name <code className="font-semibold text-foreground">{item?.code ?? item?.adName}</code> can link automatically.
            </span>
          </span>
        </label>
        <p className="mt-3 text-xs text-muted">This creates a new Ad ID link; it does not replace an older link or rename the Meta ad.</p>
        {error ? <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter className="mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={isSaving} iconLeft={<Link2 className="h-4 w-4" />} onClick={submit}>Link creative</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
