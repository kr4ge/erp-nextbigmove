'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useTeams } from '@/hooks/use-teams';
import { useToast } from '@/components/ui/toast';
import type { Integration } from '../types';
import type { PosShopOption, TeamOption } from '../_types/integration-management';
import {
  getSelectedTeamIdsFromStorage,
  getTeamScopeFromEvent,
} from '../_utils/team-scope';
import { parseIntegrationErrorMessage } from '../_utils/integration-error';
import { integrationManagementService } from '../_services/integration-management.service';

type Provider = 'META_ADS' | 'PANCAKE_POS';

function sanitizeTeamId(value: string | null | undefined) {
  if (!value || value === 'ALL_TEAMS') return null;
  return value;
}

function filterSharedForSave(ids: string[], owner?: string | null) {
  const ownerClean = sanitizeTeamId(owner);
  return ids.filter((id) => id && id !== ownerClean);
}

export function useIntegrationsController() {
  const router = useRouter();
  const { addToast } = useToast();

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [integrationTeamId, setIntegrationTeamId] = useState('');
  const [allIntegrations, setAllIntegrations] = useState<Integration[]>([]);
  const [filteredIntegrations, setFilteredIntegrations] = useState<Integration[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState<Provider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [posApiKey, setPosApiKey] = useState('');
  const [posDescription, setPosDescription] = useState('');
  const [posShops, setPosShops] = useState<PosShopOption[]>([]);
  const [posSelectedShopId, setPosSelectedShopId] = useState('');
  const [editIntegrationId, setEditIntegrationId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string>('ALL_TEAMS');
  const [sharedTeamIds, setSharedTeamIds] = useState<string[]>([]);
  const [editSharedTeamIds, setEditSharedTeamIds] = useState<string[]>([]);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [hasTeamReadAll, setHasTeamReadAll] = useState(false);
  const [canShareIntegrations, setCanShareIntegrations] = useState(false);

  const permissionsQuery = usePermissions();
  const isAdmin = hasTeamReadAll;
  const teamsQuery = useTeams(isAdmin);

  const fetchIntegrations = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) {
          setIsLoading(true);
        }
        const integrations = await integrationManagementService.fetchIntegrations();
        setAllIntegrations(integrations);
        setFilteredIntegrations(integrations);
      } catch (fetchError) {
        const message = parseIntegrationErrorMessage(fetchError);
        if (message.toLowerCase().includes('unauthorized')) {
          router.push('/login');
          return;
        }
        setError(message || 'Failed to load integrations');
      } finally {
        if (!opts?.silent) {
          setIsLoading(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const parsed = JSON.parse(userStr);
      const perms: string[] = Array.isArray(parsed.permissions) ? parsed.permissions : [];
      if (perms.includes('team.read_all') || parsed.role === 'SUPER_ADMIN') {
        setHasTeamReadAll(true);
      }
      setCanShareIntegrations(perms.includes('integration.share'));
    }
    const selected = getSelectedTeamIdsFromStorage();
    if (selected.length > 0) {
      setIntegrationTeamId(selected[0]);
    }
  }, []);

  useEffect(() => {
    void fetchIntegrations();

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'current_team_ids' && event.key !== 'current_team_id') return;
      const selected = getSelectedTeamIdsFromStorage();
      setIntegrationTeamId(selected[0] || '');
      void fetchIntegrations({ silent: true });
    };

    const onTeamScope = (event: Event) => {
      const selected = getTeamScopeFromEvent(event);
      setIntegrationTeamId(selected[0] || '');
      void fetchIntegrations({ silent: true });
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, [fetchIntegrations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = searchInput.trim().toLowerCase();
      if (!term) {
        setFilteredIntegrations(allIntegrations);
        return;
      }

      setFilteredIntegrations(
        allIntegrations.filter((integration) => {
          const name = integration.name?.toLowerCase() || '';
          const provider = integration.provider?.toLowerCase() || '';
          const description = (integration.description || '').toLowerCase();
          return (
            name.includes(term) ||
            provider.includes(term) ||
            description.includes(term)
          );
        }),
      );
    }, 450);

    return () => clearTimeout(timer);
  }, [allIntegrations, searchInput]);

  useEffect(() => {
    const permissions = permissionsQuery.data;
    if (!Array.isArray(permissions)) return;
    setHasTeamReadAll(
      permissions.includes('team.read_all') || permissions.includes('permission.assign'),
    );
    setCanShareIntegrations(permissions.includes('integration.share'));
  }, [permissionsQuery.data]);

  useEffect(() => {
    const teamList = (teamsQuery.data || []) as TeamOption[];
    setTeams(teamList);

    const selected = getSelectedTeamIdsFromStorage();
    const candidate = selected[0] || teamList[0]?.id || '';
    if (!integrationTeamId && candidate) {
      setIntegrationTeamId(candidate);
      localStorage.setItem('current_team_id', candidate);
      localStorage.setItem('current_team_ids', JSON.stringify([candidate]));
    }
  }, [integrationTeamId, teamsQuery.data]);

  useEffect(() => {
    if (isAdmin || teams.length === 0) return;
    const firstTeamId = teams[0]?.id;
    const current = sanitizeTeamId(integrationTeamId);
    if (!current && firstTeamId) {
      setIntegrationTeamId(firstTeamId);
      localStorage.setItem('current_team_id', firstTeamId);
    }
  }, [integrationTeamId, isAdmin, teams]);

  useEffect(() => {
    if (!canShareIntegrations) return;
    const owner = sanitizeTeamId(integrationTeamId);
    setSharedTeamIds((prev) => prev.filter((id) => id !== owner));
  }, [canShareIntegrations, integrationTeamId]);

  useEffect(() => {
    if (!canShareIntegrations) return;
    const owner = sanitizeTeamId(editTeamId);
    setEditSharedTeamIds((prev) => prev.filter((id) => id !== owner));
  }, [canShareIntegrations, editTeamId]);

  const resetConnectModal = () => {
    setIsSubmitting(false);
    setMetaAccessToken('');
    setPosApiKey('');
    setPosDescription('');
    setPosShops([]);
    setPosSelectedShopId('');
    setSharedTeamIds([]);
  };

  const toggleSharedTeam = (teamId: string) => {
    setSharedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const toggleEditSharedTeam = (teamId: string) => {
    setEditSharedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const resolvedTeamId = () => sanitizeTeamId(integrationTeamId);

  const openModal = (provider: Provider) => {
    resetConnectModal();
    setModalProvider(provider);
    setIsModalOpen(true);
    setIntegrationTeamId(integrationTeamId || '');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProvider(null);
    resetConnectModal();
  };

  const openEditModal = (integration: Integration) => {
    setEditIntegrationId(integration.id);
    setEditTeamId(integration.teamId || 'ALL_TEAMS');
    setEditSharedTeamIds(integration.sharedTeamIds || []);
  };

  const closeEditModal = () => {
    setEditIntegrationId(null);
    setEditTeamId('ALL_TEAMS');
    setEditSharedTeamIds([]);
    setIsEditSubmitting(false);
  };

  const handleView = async (integration: Integration) => {
    if (integration.provider === 'META_ADS') {
      router.push(`/integrations/meta/${integration.id}`);
      return;
    }

    if (integration.provider === 'PANCAKE_POS') {
      try {
        const stores = await integrationManagementService.fetchPosStores();
        const configShopId = integration.config?.shopId?.toString?.() ?? integration.config?.shopId;

        const linkedStore =
          stores.find((store) => (store as { integrationId?: string }).integrationId === integration.id) ||
          (configShopId
            ? stores.find(
                (store) =>
                  (store as { shopId?: string | number }).shopId?.toString?.() ===
                  configShopId.toString(),
              )
            : null);

        const linkedStoreId = (linkedStore as { id?: string } | null)?.id;
        if (!linkedStoreId) {
          addToast('error', 'No linked POS store found for this integration.');
          return;
        }

        router.push(`/integrations/store/${linkedStoreId}`);
      } catch (viewError) {
        addToast('error', parseIntegrationErrorMessage(viewError));
      }
      return;
    }

    addToast('error', 'Unsupported integration provider.');
  };

  const handleMetaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const sharedIds = canShareIntegrations
        ? filterSharedForSave(sharedTeamIds, resolvedTeamId())
        : undefined;

      await integrationManagementService.createIntegration({
        name: 'Meta Ads Integration',
        provider: 'META_ADS',
        credentials: { accessToken: metaAccessToken },
        config: {},
        teamId: resolvedTeamId() || undefined,
        ...(canShareIntegrations ? { sharedTeamIds: sharedIds } : {}),
      });

      await fetchIntegrations();
      addToast('success', 'Meta Ads integration connected successfully!');
      closeModal();
    } catch (submitError) {
      addToast('error', parseIntegrationErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const createPosIntegration = async (shop: PosShopOption) => {
    const ownerTeam = resolvedTeamId();
    const sharedIds = canShareIntegrations
      ? filterSharedForSave(sharedTeamIds, ownerTeam)
      : undefined;

    await integrationManagementService.createIntegration({
      name: shop.name,
      description: posDescription,
      provider: 'PANCAKE_POS',
      credentials: { apiKey: posApiKey },
      config: {
        shopId: shop.id.toString(),
        shopName: shop.name,
        shopAvatarUrl: shop.avatar_url,
      },
      teamId: ownerTeam || undefined,
      ...(canShareIntegrations ? { sharedTeamIds: sharedIds } : {}),
    });
  };

  const handlePosSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const duplicate = await integrationManagementService.checkPosStoreDuplicate(posApiKey);
      if (duplicate?.duplicate) {
        addToast('error', duplicate?.reason || 'This store is already connected.');
        return;
      }

      const shops = await integrationManagementService.fetchPancakeShops(posApiKey);
      if (shops.length === 0) {
        addToast('error', 'No shops found for this API key.');
        return;
      }

      if (shops.length === 1) {
        await createPosIntegration(shops[0]);
        await fetchIntegrations();
        addToast('success', 'Pancake POS store connected successfully!');
        closeModal();
        return;
      }

      setPosShops(shops);
      addToast('info', `Found ${shops.length} shops. Please select one to connect.`);
    } catch (submitError) {
      addToast('error', parseIntegrationErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePosShopSelect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!posSelectedShopId) {
      addToast('error', 'Please select a shop to connect.');
      return;
    }

    const selectedShop = posShops.find(
      (shop) => shop.id.toString() === posSelectedShopId.toString(),
    );
    if (!selectedShop) {
      addToast('error', 'Selected shop not found. Please try again.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createPosIntegration(selectedShop);
      await fetchIntegrations();
      addToast('success', `${selectedShop.name} connected successfully!`);
      closeModal();
    } catch (submitError) {
      addToast('error', parseIntegrationErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTeamSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editIntegrationId) return;
    setIsEditSubmitting(true);

    try {
      const payloadTeam = isAdmin && editTeamId === 'ALL_TEAMS' ? null : editTeamId || null;
      const payloadShared =
        canShareIntegrations && editSharedTeamIds
          ? filterSharedForSave(editSharedTeamIds, payloadTeam)
          : undefined;

      await integrationManagementService.updateIntegration(editIntegrationId, {
        teamId: payloadTeam || undefined,
        ...(canShareIntegrations ? { sharedTeamIds: payloadShared } : {}),
      });

      await fetchIntegrations();
      addToast('success', 'Integration updated successfully!');
      closeEditModal();
    } catch (submitError) {
      addToast('error', parseIntegrationErrorMessage(submitError));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await integrationManagementService.deleteIntegration(id);
      await fetchIntegrations();
      addToast('success', `"${name}" deleted successfully!`);
    } catch (deleteError) {
      addToast('error', parseIntegrationErrorMessage(deleteError));
    }
  };

  const metaIntegrations = useMemo(
    () => allIntegrations.filter((integration) => integration.provider === 'META_ADS'),
    [allIntegrations],
  );
  const posIntegrations = useMemo(
    () => allIntegrations.filter((integration) => integration.provider === 'PANCAKE_POS'),
    [allIntegrations],
  );
  const connectOwnerTeamId = sanitizeTeamId(integrationTeamId);
  const editOwnerTeamId = sanitizeTeamId(editTeamId);

  return {
    teams,
    integrationTeamId,
    setIntegrationTeamId,
    allIntegrations,
    filteredIntegrations,
    searchInput,
    setSearchInput,
    isLoading,
    error,
    isModalOpen,
    modalProvider,
    isSubmitting,
    metaAccessToken,
    setMetaAccessToken,
    posApiKey,
    setPosApiKey,
    posDescription,
    setPosDescription,
    posShops,
    posSelectedShopId,
    setPosSelectedShopId,
    editIntegrationId,
    editTeamId,
    setEditTeamId,
    sharedTeamIds,
    editSharedTeamIds,
    isEditSubmitting,
    isAdmin,
    canShareIntegrations,
    metaIntegrations,
    posIntegrations,
    connectOwnerTeamId,
    editOwnerTeamId,
    openModal,
    closeModal,
    openEditModal,
    closeEditModal,
    toggleSharedTeam,
    toggleEditSharedTeam,
    handleView,
    handleMetaSubmit,
    handlePosSubmit,
    handlePosShopSelect,
    handleEditTeamSubmit,
    handleDelete,
    refreshIntegrations: fetchIntegrations,
  };
}
