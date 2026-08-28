'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { transitionCreativeStatus, updateVideoRegistryItem } from '../../video-registry/_services/video-registry.service';
import type { UpdateVideoRegistryInput } from '../../video-registry/_types/video-registry';
import { addCreativeAssetComment, fetchCreativeAssetComments, fetchCreativeAssets } from '../_services/creative-assets.service';
import type { CreativeAsset, CreativeAssetComment, CreativeAssetsParams, CreativeAssetsResponse, CreativeAssetsView } from '../_types/creative-assets';

const DEFAULT_PARAMS: CreativeAssetsParams = { query: '', storeId: '', creatorId: '', creativeId: '', revisionState: '', queue: '', page: 1, pageSize: 12 };

const REVISION_STATE_VALUES = ['NONE', 'NEEDS_REVISION', 'RESOLVED'];

export type CreativeAssetsInitialFilters = {
  query?: string;
  creativeId?: string;
  revisionState?: string;
  queue?: string;
};

export function useCreativeAssetsController(initial: CreativeAssetsInitialFilters = {}) {
  const normalizedInitialQuery = (initial.query ?? '').trim();
  const permissionsQuery = usePermissions();
  const permissions = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);
  const canReview = permissions.includes('creative_agent.review');
  const canReadAllPermission = permissions.includes('creative_agent.read_all');
  const [params, setParams] = useState<CreativeAssetsParams>(() => ({
    ...DEFAULT_PARAMS,
    query: normalizedInitialQuery,
    creativeId: initial.creativeId ?? '',
    revisionState: REVISION_STATE_VALUES.includes(initial.revisionState ?? '')
      ? (initial.revisionState as CreativeAssetsParams['revisionState'])
      : '',
    // Assets opens on all creatives; the review queue is reachable via filters.
    queue: '',
  }));
  const [searchText, setSearchText] = useState(normalizedInitialQuery);
  const [data, setData] = useState<CreativeAssetsResponse | null>(null);
  const [view, setView] = useState<CreativeAssetsView>('tiles');
  const [selected, setSelected] = useState<CreativeAsset | null>(null);
  const [editing, setEditing] = useState<CreativeAsset | null>(null);
  const [comments, setComments] = useState<CreativeAssetComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may write state — the reviewer-default effect can
  // fire a second fetch while the first is still in flight.
  const requestSeq = useRef(0);
  const load = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const result = await fetchCreativeAssets(params);
      if (seq === requestSeq.current) setData(result);
    }
    catch (loadError) {
      if (seq === requestSeq.current) setError(loadError instanceof Error ? loadError.message : 'Unable to load Creative Assets.');
    }
    finally { if (!silent && seq === requestSeq.current) setIsLoading(false); }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  // Advertising reviewers land on their approval queue by default — applied
  // once when permissions resolve and only if no explicit filter was deep-linked.
  const appliedReviewerDefault = useRef(false);
  useEffect(() => {
    if (appliedReviewerDefault.current || !canReview || !canReadAllPermission) return;
    appliedReviewerDefault.current = true;
    if (initial.revisionState || initial.queue || initial.creativeId || normalizedInitialQuery) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReview, canReadAllPermission]);

  // Deep link (/assets?creative=<uuid>): open the review dialog on the row as
  // soon as it arrives, then clear the marker so filters behave normally.
  const openedDeepLink = useRef(false);
  useEffect(() => {
    if (openedDeepLink.current || !params.creativeId || !data) return;
    const match = data.items.find((item) => item.id === params.creativeId);
    if (match) {
      openedDeepLink.current = true;
      void openAssetRef.current?.(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params.creativeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setParams((current) => {
      const query = searchText.trim();
      return current.query === query ? current : { ...current, query, page: 1 };
    }), 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const openAsset = useCallback(async (asset: CreativeAsset) => {
    setSelected(asset); setComments([]); setIsLoadingComments(true);
    try { setComments(await fetchCreativeAssetComments(asset.id)); }
    catch (commentError) { setError(commentError instanceof Error ? commentError.message : 'Unable to load feedback.'); }
    finally { setIsLoadingComments(false); }
  }, []);
  const openAssetRef = useRef<typeof openAsset | null>(null);
  useEffect(() => { openAssetRef.current = openAsset; }, [openAsset]);

  const addComment = useCallback(async (message: string) => {
    if (!selected) return;
    setIsMutating(true);
    try {
      const created = await addCreativeAssetComment(selected.id, message);
      setComments((current) => [...current, created]);
      await load(true);
    }
    finally { setIsMutating(false); }
  }, [load, selected]);

  const transition = useCallback(async (toStatus: string, reason?: string) => {
    if (!selected) return;
    setIsMutating(true);
    try { await transitionCreativeStatus(selected.id, 'REVISION', toStatus, reason); setSelected(null); setComments([]); await load(true); }
    finally { setIsMutating(false); }
  }, [load, selected]);

  const openEdit = useCallback((asset: CreativeAsset) => {
    setSelected(null);
    setComments([]);
    setEditing(asset);
  }, []);

  const updateCreative = useCallback(async (id: string, input: UpdateVideoRegistryInput) => {
    setIsMutating(true);
    try {
      await updateVideoRegistryItem(id, input);
      setEditing(null);
      await load(true);
    } finally {
      setIsMutating(false);
    }
  }, [load]);

  const updateParams = useCallback((patch: Partial<CreativeAssetsParams>) => setParams((current) => ({ ...current, ...patch, page: patch.page ?? 1 })), []);
  return { params, searchText, data, view, selected, editing, comments, isLoading, isLoadingComments, isMutating, error, canReview, setSearchText, setView, setSelected, setEditing, updateParams, openAsset, openEdit, addComment, transition, updateCreative, retry: load };
}
