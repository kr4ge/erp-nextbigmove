'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_VIDEO_REGISTRY_PARAMS } from '../_constants/video-registry.constants';
import { usePermissions } from '@/hooks/use-permissions';
import {
  createVideoRegistryItem,
  fetchCreativeStores,
  fetchCreativeReviewComments,
  fetchVideoRegistry,
  linkCreativeAlias,
  transitionCreativeStatus,
  updateVideoRegistryItem,
} from '../_services/video-registry.service';
import type {
  CreativeStatusDimension,
  CreativeReviewComment,
  CreativeStoreOption,
  CreateVideoRegistryInput,
  GetVideoRegistryParams,
  LinkCreativeAliasInput,
  UpdateVideoRegistryInput,
  UnregisteredMetaCreative,
  VideoRegistryItem,
  VideoRegistryResponse,
  VideoRegistryView,
} from '../_types/video-registry';

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
  const [createdItem, setCreatedItem] = useState<VideoRegistryItem | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [stores, setStores] = useState<CreativeStoreOption[]>([]);

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

  const loadRegistry = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      setData(await fetchVideoRegistry(params));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the video registry.');
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

  const loadStores = useCallback(async () => {
    setStores(await fetchCreativeStores());
  }, []);

  useEffect(() => {
    if (permissions.canEnroll) void loadStores().catch(() => undefined);
  }, [loadStores, permissions.canEnroll]);

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
    setCreatedItem(null);
    setRegistrationSeed(seed ?? null);
    setIsRegisterOpen(true);
  }, []);

  const closeRegistration = useCallback(() => {
    setIsRegisterOpen(false);
    setRegistrationSeed(null);
    setCreatedItem(null);
  }, []);

  const registerVideo = useCallback(async (input: CreateVideoRegistryInput) => {
    setIsMutating(true);
    try {
      const created = await createVideoRegistryItem(input);
      setCreatedItem(created);
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
      params.qcStatus || params.performanceStatus,
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
    createdItem,
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
    retry: loadRegistry,
  };
}
