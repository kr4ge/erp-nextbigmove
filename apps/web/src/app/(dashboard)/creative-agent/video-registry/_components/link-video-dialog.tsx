'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LinkCreativeAliasInput, UnregisteredMetaCreative, VideoRegistryItem } from '../_types/video-registry';

type Props = {
  item: UnregisteredMetaCreative | null;
  videos: VideoRegistryItem[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: LinkCreativeAliasInput) => Promise<void>;
};

export function LinkVideoDialog({ item, videos, isSaving, onClose, onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setQuery('');
    setSelectedId('');
    setError(null);
  }, [item]);

  const results = useMemo(() => {
    const availableVideos = videos.filter(
      (video) => !video.metaAdId,
    );
    const normalized = query.trim().toLowerCase();
    if (!normalized) return availableVideos;
    return availableVideos.filter((video) => `${video.code} ${video.title} ${video.store.name}`.toLowerCase().includes(normalized));
  }, [query, videos]);

  const hasAvailableVideos = useMemo(
    () => videos.some((video) => !video.metaAdId),
    [videos],
  );

  const submit = async () => {
    if (!item || !selectedId) return setError('Select the registry video this Meta ad belongs to.');
    setError(null);
    try {
      await onSubmit({
        unregisteredKey: item.key,
        creativeId: selectedId,
        alias: item.code ?? item.adName,
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
          <DialogTitle>Link Meta ad to a registered video</DialogTitle>
          <DialogDescription>
            The unmatched name <code className="font-semibold text-foreground">{item?.adName}</code> will be saved as an alias for the selected video.
          </DialogDescription>
        </DialogHeader>
        <label className="relative mt-5 block">
          <span className="sr-only">Search registered videos</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="input w-full pl-9" placeholder="Search by title, code, or store" />
        </label>
        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Registered videos">
          {results.length ? results.map((video) => (
            <label key={video.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${selectedId === video.id ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-background-secondary'}`}>
              <input type="radio" name="registry-video" value={video.id} checked={selectedId === video.id} onChange={() => setSelectedId(video.id)} className="mt-1" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground">{video.title}</span>
                <span className="mt-1 block text-xs text-muted"><code className="font-semibold text-primary">{video.code}</code> · {video.store.name}</span>
              </span>
            </label>
          )) : (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              {hasAvailableVideos
                ? 'No available videos match this search.'
                : 'All registry videos on this page are already linked to Meta ads.'}
            </p>
          )}
        </div>
        <p className="mt-4 text-xs text-muted">Manual linking is explicit and reversible in the future data model. It does not rename the Meta ad.</p>
        {error ? <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter className="mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={isSaving} iconLeft={<Link2 className="h-4 w-4" />} onClick={submit}>Link video</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
