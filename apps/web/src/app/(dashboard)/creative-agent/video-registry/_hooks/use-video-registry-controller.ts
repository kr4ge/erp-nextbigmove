'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_VIDEO_REGISTRY_PARAMS } from '../_constants/video-registry.constants';
import { usePermissions } from '@/hooks/use-permissions';
import {
  createVideoRegistryItem,
  fetchCreativeReviewComments,
  fetchVideoRegistry,
  linkCreativeAlias,
  removeCreativeThumbnail,
  transitionCreativeStatus,
  unlinkCreativeMetaAd,
  updateVideoRegistryItem,
  uploadCreativeThumbnail,
} from '../_services/video-registry.service';
import type {
  CreativeStatusDimension,
  CreativeReviewComment,
  CreateVideoRegistryInput,
  GetVideoRegistryParams,
  LinkCreativeAliasInput,
  UpdateVideoRegistryInput,
  UnregisteredMetaCreative,
  VideoRegistryItem,
  VideoRegistryResponse,
  VideoRegistryView,
} from '../_types/video-registry';
import { useCreativeStores } from './use-creative-stores';

const SEARCH_DEBOUNCE_MS = 300;

export function useVideoRegistryController(initialQuery = '') {
  const permissionsQuery = usePermissions();
  const normalizedInitialQuery = initialQuery.trim();
  const [params, setParams] = useState<GetVideoRegistryParams>(() => ({ ...DEFAULT_VIDEO_REGISTRY_PARAMS, query: normalizedInitialQuery }));
  const [searchText, setSearchText] = useState(normalizedInitialQuery);
  const [data, setData] = useState<VideoRegistryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<VideoRegistryView>('tiles');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registrationSeed, setRegistrationSeed] = useState<UnregisteredMetaCreative | null>(null);
  const [linkingItem, setLinkingItem] = useState<UnregisteredMetaCreative | null>(null);
  const [reviewingItem, setReviewingItem] = useState<VideoRegistryItem | null>(null);
  const [editingItem, setEditingItem] = useState<VideoRegistryItem | null>(null);
  const [reviewComments, setReviewComments] = useState<CreativeReviewComment[]>([]);
  const [isLoadingReviewComments, setIsLoadingReviewComments] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const permissions = useMemo(() => {
    const values = permissionsQuery.data ?? [];
    return {
      canReadAll: values.includes('creative_agent.read_all'),
      canEnroll: values.includes('creative_agent.enroll'),
      canEdit: values.includes('creative_agent.edit'),
      canEditAll: values.includes('creative_agent.edit_all'),
      canManageAliases: values.includes('creative_agent.alias.manage'),
      canReview: values.includes('creative_agent.review'),
      canManagePerformance: values.includes('creative_agent.performance.manage'),
    };
  }, [permissionsQuery.data]);
  const { stores } = useCreativeStores(permissions.canEnroll);

  /** Returns the response too, so a mutation can re-read an open dialog's row from it. */
  const loadRegistry = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const response = await fetchVideoRegistry(params);
      setData(response);
      return response;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the video registry.');
      return null;
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const query = searchText.trim();
      setParams((current) => current.query === query ? current : { ...current, query, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const updateParams = useCallback((patch: Partial<GetVideoRegistryParams>) => {
    setParams((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);

  const updateUnregisteredPage = useCallback((page: number) => {
    setParams((current) => ({ ...current, unregisteredPage: page }));
  }, []);

  const resetFilters = useCallback(() => {
    setParams(DEFAULT_VIDEO_REGISTRY_PARAMS);
    setSearchText(DEFAULT_VIDEO_REGISTRY_PARAMS.query);
  }, []);

  const openRegistration = useCallback((seed?: UnregisteredMetaCreative) => {
    setRegistrationSeed(seed ?? null);
    setIsRegisterOpen(true);
  }, []);

  const closeRegistration = useCallback(() => {
    setIsRegisterOpen(false);
    setRegistrationSeed(null);
  }, []);

  const registerVideo = useCallback(async (input: CreateVideoRegistryInput) => {
    setIsMutating(true);
    try {
      const created = await createVideoRegistryItem(input);
      // One call per creative in a batch; the dialog closes itself once every
      // entry has registered, so the list refreshes here but stays open.
      await loadRegistry({ silent: true });
      return created;
    } finally {
      setIsMutating(false);
    }
  }, [loadRegistry]);

  const linkAlias = useCallback(async (input: LinkCreativeAliasInput) => {
    setIsMutating(true);
    try {
      await linkCreativeAlias(input);
      setLinkingItem(null);
      await loadRegistry({ silent: true });
    } finally {
      setIsMutating(false);
    }
  }, [loadRegistry]);

  const openReview = useCallback(async (item: VideoRegistryItem) => {
    setReviewingItem(item);
    setReviewComments([]);
    setIsLoadingReviewComments(true);
    try {
      setReviewComments(await fetchCreativeReviewComments(item.id));
    } catch {
      setReviewComments([]);
    } finally {
      setIsLoadingReviewComments(false);
    }
  }, []);

  const closeReview = useCallback(() => {
    setReviewingItem(null);
    setReviewComments([]);
  }, []);

  const openEdit = useCallback((item: VideoRegistryItem) => {
    setReviewingItem(null);
    setReviewComments([]);
    setEditingItem(item);
  }, []);

  const updateCreative = useCallback(async (id: string, input: UpdateVideoRegistryInput) => {
    setIsMutating(true);
    try {
      await updateVideoRegistryItem(id, input);
      setEditingItem(null);
      await loadRegistry({ silent: true });
    } finally {
      setIsMutating(false);
    }
  }, [loadRegistry]);

  /** For a wrong link: detaches one Meta ad, then re-syncs the open review item. */
  const unlinkMetaAd = useCallback(async (creativeId: string, accountId: string, adId: string) => {
    setIsMutating(true);
    try {
      await unlinkCreativeMetaAd(accountId, adId);
      // Re-read the row from the refreshed LIST, not from the single-creative
      // endpoint: that one returns the detail shape, which carries no metrics,
      // and the review dialog behind this renders them.
      const refreshed = await loadRegistry({ silent: true });
      setReviewingItem((current) => {
        if (!current || current.id !== creativeId) return current;
        return refreshed?.items.find((entry) => entry.id === creativeId) ?? current;
      });
    } finally {
      setIsMutating(false);
    }
  }, [loadRegistry]);

  /** Keeps the open Edit dialog showing the new cover without closing it. */
  const uploadThumbnail = useCallback(async (creativeId: string, file: File) => {
    setIsMutating(true);
    try {
      const result = await uploadCreativeThumbnail(creativeId, file);
      setEditingItem((current) => (current && current.id === creativeId ? { ...current, ...result } : current));
      await loadRegistry({ silent: true });
      return result;
    } finally {
      setIsMutating(false);
    }
  }, [loadRegistry]);

  const removeThumbnail = useCallback(async (creativeId: string) => {
    setIsMutating(true);
    try {
      const result = await removeCreativeThumbnail(creativeId);
      setEditingItem((current) => (current && current.id === creativeId ? { ...current, ...result } : current));
      await loadRegistry({ silent: true });
    } finally {
      setIsMutating(false);
    }
  }, [loadRegistry]);

  const transitionStatus = useCallback(async (creativeId: string, dimension: CreativeStatusDimension, toStatus: string, reason?: string) => {
    setIsMutating(true);
    try {
      await transitionCreativeStatus(creativeId, dimension, toStatus, reason);
      closeReview();
      await loadRegistry({ silent: true });
    } finally { setIsMutating(false); }
  }, [closeReview, loadRegistry]);

  const hasActiveFilters = useMemo(
    () => Boolean(
      params.query || params.kind || params.accountId || params.storeId || params.creatorId ||
      params.revisionState || params.performanceStatus,
    ),
    [params],
  );

  return {
    params,
    searchText,
    data,
    isLoading,
    error,
    view,
    isRegisterOpen,
    registrationSeed,
    linkingItem,
    reviewingItem,
    editingItem,
    reviewComments,
    isLoadingReviewComments,
    isMutating,
    stores,
    permissions,
    hasActiveFilters,
    updateParams,
    updateUnregisteredPage,
    setSearchText,
    resetFilters,
    setView,
    openRegistration,
    closeRegistration,
    setLinkingItem,
    openReview,
    openEdit,
    closeReview,
    setEditingItem,
    registerVideo,
    linkAlias,
    transitionStatus,
    updateCreative,
    unlinkMetaAd,
    uploadThumbnail,
    removeThumbnail,
    retry: loadRegistry,
  };
}
