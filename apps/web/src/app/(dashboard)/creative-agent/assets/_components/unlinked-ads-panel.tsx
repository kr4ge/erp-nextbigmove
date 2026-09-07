'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  createVideoRegistryItem,
  fetchVideoRegistry,
  linkCreativeAlias,
} from '../../video-registry/_services/video-registry.service';
import { DEFAULT_VIDEO_REGISTRY_PARAMS } from '../../video-registry/_constants/video-registry.constants';
import { UnregisteredMetaPanel } from '../../video-registry/_components/unregistered-meta-panel';
import { LinkVideoDialog } from '../../video-registry/_components/link-video-dialog';
import { RegisterVideoDialog } from '../../video-registry/_components/register-video-dialog';
import type {
  LinkCreativeAliasInput,
  UnregisteredMetaCreative,
  VideoRegistryResponse,
} from '../../video-registry/_types/video-registry';

/**
 * The "spending but not registered" list, surfaced inside the Advertising
 * Assets workspace so an advertiser (read_all + alias.manage, but no
 * creative_agent.read) can link or register Meta ads that missed the naming
 * convention — the same flow the Video Registry gives creatives, without
 * pulling the whole registry module into this workspace.
 *
 * Self-contained: it owns its fetch and its dialog state, and reuses the
 * registry's panel and dialogs verbatim so the two stay in lockstep.
 */
export function UnlinkedAdsPanel() {
  const { addToast } = useToast();
  const [data, setData] = useState<VideoRegistryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [linkingItem, setLinkingItem] = useState<UnregisteredMetaCreative | null>(null);
  const [registerSeed, setRegisterSeed] = useState<UnregisteredMetaCreative | null>(null);
  const [isRegisterOpen, setRegisterOpen] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchVideoRegistry({
        ...DEFAULT_VIDEO_REGISTRY_PARAMS,
        // Only the unregistered list matters here; keep the library slice small.
        pageSize: 1,
        unregisteredPage: page,
      });
      setData(response);
    } catch {
      // Silent: the panel simply does not render if the list cannot load.
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const stores = (data?.filters.stores ?? []).map((store) => ({
    value: store.value,
    label: store.label,
    nextCode: store.nextCode,
  }));

  const submitLink = async (input: LinkCreativeAliasInput) => {
    setSaving(true);
    try {
      await linkCreativeAlias(input);
      addToast('success', 'Ad linked to the creative.');
      setLinkingItem(null);
      await load();
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Unable to link this ad.');
    } finally {
      setSaving(false);
    }
  };

  if (!data || data.unregisteredPagination.total === 0) return null;

  return (
    <div className="mb-4">
      <UnregisteredMetaPanel
        items={data.unregistered}
        onRegister={(item) => { setRegisterSeed(item); setRegisterOpen(true); }}
        onLink={setLinkingItem}
        canRegister
        canLink
        pagination={data.unregisteredPagination}
        onPageChange={setPage}
      />

      <LinkVideoDialog
        item={linkingItem}
        videos={data.items}
        isSaving={isSaving}
        onClose={() => setLinkingItem(null)}
        onSubmit={submitLink}
      />

      <RegisterVideoDialog
        open={isRegisterOpen}
        stores={stores}
        seed={registerSeed}
        isSaving={isSaving}
        creatorLabel={data.viewer?.adNameCreator ?? null}
        onClose={() => { setRegisterOpen(false); setRegisterSeed(null); }}
        onSubmit={async (input) => {
          setSaving(true);
          try {
            const created = await createVideoRegistryItem(input);
            await load();
            return created;
          } finally {
            setSaving(false);
          }
        }}
        onRegistered={(count) => {
          addToast('success', count === 1 ? 'Creative registered.' : `${count} creatives registered.`);
        }}
      />
    </div>
  );
}
