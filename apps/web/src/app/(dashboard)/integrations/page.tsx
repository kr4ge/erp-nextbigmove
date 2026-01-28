'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import type { Integration } from './types';
import {
  formatIntegrationDate,
  getProviderIcon,
  getProviderName,
  getStatusBadgeClasses,
} from './utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/emptystate';
import { MoreVertical, X, LinkIcon } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useTeams } from '@/hooks/use-teams';
import { useToast } from '@/components/ui/toast';

/**
 * Parse API error responses and return user-friendly messages
 */
const parseErrorMessage = (error: any): string => {
  // Handle Axios/fetch response errors
  const data = error?.response?.data || error?.data;

  // Try to parse JSON string errors (like from Pancake POS API)
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      // Not JSON, use as-is
    }
  }

  // Handle Pancake POS API error format: {"error_code":105,"message":"api_key is invalid","success":false}
  if (parsed && typeof parsed === 'object') {
    if (parsed.error_code === 105 || parsed.message?.toLowerCase().includes('api_key is invalid')) {
      return 'Invalid API key. Please check your API key and try again.';
    }
    if (parsed.error_code === 101 || parsed.message?.toLowerCase().includes('unauthorized')) {
      return 'Unauthorized. Please check your credentials.';
    }
    if (parsed.message) {
      // Clean up common API error messages
      const msg = parsed.message;
      if (msg.toLowerCase().includes('not found')) {
        return 'Resource not found. Please verify your settings.';
      }
      if (msg.toLowerCase().includes('rate limit')) {
        return 'Too many requests. Please wait a moment and try again.';
      }
      return msg;
    }
  }

  // Handle string error message
  if (typeof error === 'string') {
    try {
      const jsonError = JSON.parse(error);
      if (jsonError.message) {
        return parseErrorMessage({ data: jsonError });
      }
    } catch {
      return error;
    }
  }

  // Handle error.message
  if (error?.message) {
    // Check if the message itself is JSON
    try {
      const jsonMsg = JSON.parse(error.message);
      return parseErrorMessage({ data: jsonMsg });
    } catch {
      return error.message;
    }
  }

  return 'An unexpected error occurred. Please try again.';
};

const getSelectedTeamIds = () => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('current_team_ids');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t) => typeof t === 'string' && t.length > 0);
      }
    } catch {
      // ignore
    }
  }
  const single = localStorage.getItem('current_team_id');
  return single && single !== 'ALL_TEAMS' ? [single] : [];
};

export default function IntegrationsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [userRole, setUserRole] = useState<string>('');
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [integrationTeamId, setIntegrationTeamId] = useState<string>('');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState<'META_ADS' | 'PANCAKE_POS' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [posApiKey, setPosApiKey] = useState('');
  const [posDescription, setPosDescription] = useState('');
  const [posShops, setPosShops] = useState<any[]>([]);
  const [posSelectedShopId, setPosSelectedShopId] = useState('');
  const [editIntegrationId, setEditIntegrationId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string>('ALL_TEAMS');
  const [sharedTeamIds, setSharedTeamIds] = useState<string[]>([]);
  const [editSharedTeamIds, setEditSharedTeamIds] = useState<string[]>([]);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const permissionsQuery = usePermissions();
  const [hasTeamReadAll, setHasTeamReadAll] = useState(false);
  const [canShareIntegrations, setCanShareIntegrations] = useState(false);

  // Admin = has team.read_all (or legacy super_admin)
  const isAdmin = hasTeamReadAll;

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-integration-actions]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setUserRole(parsed.role);
        const perms: string[] = Array.isArray(parsed.permissions) ? parsed.permissions : [];
        if (perms.includes('team.read_all') || parsed.role === 'SUPER_ADMIN') {
          setHasTeamReadAll(true);
        }
        setCanShareIntegrations(perms.includes('integration.share'));
      }
      const selected = getSelectedTeamIds();
      if (selected.length > 0) {
        setIntegrationTeamId(selected[0]);
      }
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'current_team_ids' || e.key === 'current_team_id') {
        const selected = getSelectedTeamIds();
        setIntegrationTeamId(selected[0] || '');
        fetchIntegrations();
      }
    };
    const onTeamScope = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const arr = Array.isArray(detail) ? detail : [];
      setIntegrationTeamId(arr[0] || '');
      fetchIntegrations();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, []);

  // Refresh permissions from API (cached)
  useEffect(() => {
    const perms = permissionsQuery.data;
    if (perms && Array.isArray(perms)) {
      setHasTeamReadAll(
        perms.includes('team.read_all') || perms.includes('permission.assign')
      );
      setCanShareIntegrations(perms.includes('integration.share'));
    }
  }, [permissionsQuery.data]);

  const teamsQuery = useTeams(isAdmin);

  useEffect(() => {
    const list = (teamsQuery.data || []) as { id: string; name: string }[];
    setTeams(list);
    setIsLoadingTeams(teamsQuery.isLoading);
    const stored = getSelectedTeamIds();
    const candidate = stored[0] || list[0]?.id || '';
    if (!integrationTeamId && candidate) {
      setIntegrationTeamId(candidate);
      localStorage.setItem('current_team_id', candidate);
      localStorage.setItem('current_team_ids', JSON.stringify([candidate]));
    }
  }, [teamsQuery.data, teamsQuery.isLoading]);

  useEffect(() => {
    // For non-admins, default selection to their first team if not already set
    if (!isAdmin && teams.length > 0) {
      const firstTeamId = teams[0]?.id;
      const current = sanitizeTeamId(integrationTeamId);
      if (!current && firstTeamId) {
        setIntegrationTeamId(firstTeamId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('current_team_id', firstTeamId);
        }
      }
    }
  }, [teams, isAdmin, integrationTeamId]);

  useEffect(() => {
    if (!canShareIntegrations) return;
    const owner = sanitizeTeamId(integrationTeamId);
    setSharedTeamIds((prev) => prev.filter((id) => id !== owner));
  }, [integrationTeamId, canShareIntegrations]);

  useEffect(() => {
    if (!canShareIntegrations) return;
    const owner = sanitizeTeamId(editTeamId);
    setEditSharedTeamIds((prev) => prev.filter((id) => id !== owner));
  }, [editTeamId, canShareIntegrations]);

  const fetchIntegrations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }
      const scopeIds = getSelectedTeamIds();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (scopeIds.length > 0) {
        headers['X-Team-Id'] = scopeIds.join(',');
      }
      const response = await apiClient.get('/integrations', { headers });
      setIntegrations(response.data);
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setIsSubmitting(false);
    setMetaAccessToken('');
    setPosApiKey('');
    setPosDescription('');
    setPosShops([]);
    setPosSelectedShopId('');
    setSharedTeamIds([]);
  };

  const sanitizeTeamId = (value: string | null | undefined) => {
    if (!value || value === 'ALL_TEAMS') return null;
    return value;
  };

  const filterSharedForSave = (ids: string[], owner?: string | null) => {
    const ownerClean = sanitizeTeamId(owner);
    return ids.filter((id) => id && id !== ownerClean);
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

  const resolvedTeamId = () => {
    if (isAdmin) {
      return sanitizeTeamId(integrationTeamId);
    }
    // Non-admin users stick to their assigned team
    return sanitizeTeamId(integrationTeamId);
  };

  const openModal = (provider: 'META_ADS' | 'PANCAKE_POS') => {
    resetModal();
    setModalProvider(provider);
    setIsModalOpen(true);
    // Default integration team to current scope
    setIntegrationTeamId(integrationTeamId || '');
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

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProvider(null);
    resetModal();
  };

  const handleMetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        addToast('error', 'Session expired. Please log in again.');
        return;
      }
      const sharedIds = canShareIntegrations
        ? filterSharedForSave(sharedTeamIds, resolvedTeamId())
        : undefined;
      await apiClient.post(
        '/integrations',
        {
          name: 'Meta Ads Integration',
          provider: 'META_ADS',
          credentials: { accessToken: metaAccessToken },
          config: {},
          teamId: resolvedTeamId() || undefined,
          ...(canShareIntegrations ? { sharedTeamIds: sharedIds } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchIntegrations();
      addToast('success', 'Meta Ads integration connected successfully!');
      closeModal();
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const createPosIntegration = async (shop: any) => {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('Unauthorized');
    const ownerTeam = resolvedTeamId();
    const sharedIds = canShareIntegrations
      ? filterSharedForSave(sharedTeamIds, ownerTeam)
      : undefined;
    await apiClient.post(
      '/integrations',
      {
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
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const handlePosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        addToast('error', 'Session expired. Please log in again.');
        return;
      }
      const dupCheck = await apiClient.get('/integrations/pos-stores/check', {
        params: { apiKey: posApiKey },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (dupCheck.data?.duplicate) {
        const msg = dupCheck.data?.reason || 'This store is already connected.';
        addToast('error', msg);
        return;
      }
      const shopsResponse = await fetch(`https://pos.pages.fm/api/v1/shops?api_key=${posApiKey}`);
      if (!shopsResponse.ok) {
        const text = await shopsResponse.text();
        const friendlyMsg = parseErrorMessage({ message: text });
        throw new Error(friendlyMsg);
      }
      const data = await shopsResponse.json();
      const fetchedShops = data?.shops || [];
      if (fetchedShops.length === 0) {
        addToast('error', 'No shops found for this API key.');
        return;
      }
      if (fetchedShops.length === 1) {
        await createPosIntegration(fetchedShops[0]);
        await fetchIntegrations();
        addToast('success', 'Pancake POS store connected successfully!');
        closeModal();
      } else {
        setPosShops(fetchedShops);
        addToast('info', `Found ${fetchedShops.length} shops. Please select one to connect.`);
      }
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePosShopSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posSelectedShopId) {
      addToast('error', 'Please select a shop to connect.');
      return;
    }
    const shop = posShops.find((s) => s.id.toString() === posSelectedShopId.toString());
    if (!shop) {
      addToast('error', 'Selected shop not found. Please try again.');
      return;
    }
    try {
      setIsSubmitting(true);
      await createPosIntegration(shop);
      await fetchIntegrations();
      addToast('success', `${shop.name} connected successfully!`);
      closeModal();
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editIntegrationId) return;
    setIsEditSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        addToast('error', 'Session expired. Please log in again.');
        return;
      }
      const payloadTeam =
        isAdmin && editTeamId === 'ALL_TEAMS'
          ? null
          : editTeamId || null;
      const payloadShared =
        canShareIntegrations && editSharedTeamIds
          ? filterSharedForSave(editSharedTeamIds, payloadTeam)
          : undefined;
      await apiClient.patch(
        `/integrations/${editIntegrationId}`,
        {
          teamId: payloadTeam || undefined,
          ...(canShareIntegrations ? { sharedTeamIds: payloadShared } : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchIntegrations();
      addToast('success', 'Integration updated successfully!');
      closeEditModal();
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      const endpoint = currentEnabled ? 'disable' : 'enable';
      await apiClient.post(
        `/integrations/${id}/${endpoint}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchIntegrations();
      addToast('success', `Integration ${currentEnabled ? 'disabled' : 'enabled'} successfully!`);
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setOpenMenuId(null);
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      await apiClient.delete(`/integrations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      await fetchIntegrations();
      addToast('success', `"${name}" deleted successfully!`);
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await apiClient.post(
        `/integrations/${id}/test-connection`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        addToast('success', 'Connection test successful!');
      } else {
        addToast('error', response.data.message || 'Connection test failed.');
      }
      await fetchIntegrations();
    } catch (err: any) {
      const msg = parseErrorMessage(err);
      addToast('error', msg);
    }
  };

  if (isLoading) {
    return <Card className="text-center text-[#475569]">Loading integrations...</Card>;
  }

  const metaIntegrations = integrations.filter((i) => i.provider === 'META_ADS');
  const metaIntegration = metaIntegrations[0];
  const posIntegrations = integrations.filter((i) => i.provider === 'PANCAKE_POS');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your Meta Ads and Pancake POS systems to sync data."
      />
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* META Ads Card (mirrors Pancake POS layout) */}
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              {getProviderIcon('META_ADS')}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#0F172A]">Meta Marketing API</h3>
              <p className="text-sm text-[#475569]">Connect your Meta ad accounts</p>
            </div>
          </div>
          <div className="py-4 text-center">
            <p className="mb-4 text-[#475569]">
              {metaIntegrations.length === 0
                ? 'No APIs connected'
                : `${metaIntegrations.length} API${metaIntegrations.length > 1 ? 's' : ''} connected`}
            </p>
            <Button onClick={() => openModal('META_ADS')}>Add Meta API</Button>
          </div>
        </Card>

        {/* Pancake POS Card */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                {getProviderIcon('PANCAKE_POS')}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A]">Pancake POS</h3>
                <p className="text-sm text-[#475569]">Connect your POS system</p>
              </div>
            </div>
          </div>
          <div className="py-4 text-center">
            <p className="mb-4 text-[#475569]">
              {posIntegrations.length === 0
                ? 'No stores connected'
                : `${posIntegrations.length} store${posIntegrations.length > 1 ? 's' : ''} connected`}
            </p>
            <Button onClick={() => openModal('PANCAKE_POS')}>
              {posIntegrations.length === 0 ? 'Connect Pancake POS' : 'Add Another Store'}
            </Button>
          </div>
        </Card>
      </div>

      {/* All Integrations List */}
      {integrations.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-6 py-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">All Integrations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E2E8F0]">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#475569]">
                    Integration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#475569]">
                    Last Sync
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-[#475569]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {integrations.map((integration) => (
                  <tr key={integration.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="text-slate-400">{getProviderIcon(integration.provider)}</div>
                        <div>
                          <div className="text-sm font-semibold text-[#0F172A]">{integration.name}</div>
                          <div className="text-sm text-[#475569]">{getProviderName(integration.provider)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#475569]">
                      {integration.lastSyncAt ? formatIntegrationDate(integration.lastSyncAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium" data-integration-actions>
                      <div className="relative inline-block text-left">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((prev) => (prev === integration.id ? null : integration.id));
                          }}
                          aria-label="Integration actions"
                          iconLeft={<MoreVertical className="h-4 w-4" />}
                        />
                        {openMenuId === integration.id && (
                          <div className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-lg">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(integration);
                                  setOpenMenuId(null);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(integration.id, integration.name);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No integrations yet"
          description="Connect Meta Ads or Pancake POS to get started."
          actionLabel="Add Integration"
          onAction={() => openModal('PANCAKE_POS')}
          icon={<LinkIcon className="h-8 w-8" />}
        />
      )}

      {/* Connect Modal */}
      {isModalOpen && modalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#94A3B8]">Connect</p>
                <h2 className="text-xl font-semibold text-[#0F172A]">
                  {modalProvider === 'META_ADS' ? 'Meta Marketing API' : 'Pancake POS'}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal} iconLeft={<X className="h-4 w-4" />} />
            </div>
            <div className="space-y-4 px-6 py-4">
              {modalProvider === 'META_ADS' && (
                <form onSubmit={handleMetaSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A]">Team</label>
                    <select
                      value={integrationTeamId || 'ALL_TEAMS'}
                      onChange={(e) => setIntegrationTeamId(e.target.value)}
                      disabled={!isAdmin}
                      className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      {isAdmin && <option value="ALL_TEAMS">All teams (admin)</option>}
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {canShareIntegrations && (
                    <div>
                      <label className="block text-sm font-semibold text-[#0F172A]">Share with teams</label>
                      <div className="mt-2 space-y-2 rounded-xl border border-[#E2E8F0] px-4 py-3">
                        {teams.filter((t) => t.id !== sanitizeTeamId(integrationTeamId)).length === 0 ? (
                          <p className="text-sm text-slate-500">No other teams available</p>
                        ) : (
                          teams
                            .filter((t) => t.id !== sanitizeTeamId(integrationTeamId))
                            .map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={sharedTeamIds.includes(t.id)}
                                  onChange={() => toggleSharedTeam(t.id)}
                                />
                                <span>{t.name}</span>
                              </label>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A]">Access Token</label>
                    <input
                      type="password"
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      required
                      placeholder="Meta access token"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" type="button" onClick={closeModal}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
                      {isSubmitting ? 'Connecting...' : 'Connect'}
                    </Button>
                  </div>
                </form>
              )}

              {modalProvider === 'PANCAKE_POS' && (
                <form onSubmit={posShops.length > 1 ? handlePosShopSelect : handlePosSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A]">Team</label>
                    <select
                      value={integrationTeamId || 'ALL_TEAMS'}
                      onChange={(e) => setIntegrationTeamId(e.target.value)}
                      disabled={!isAdmin}
                      className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    >
                      {isAdmin && <option value="ALL_TEAMS">All teams (admin)</option>}
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {canShareIntegrations && (
                    <div>
                      <label className="block text-sm font-semibold text-[#0F172A]">Share with teams</label>
                      <div className="mt-2 space-y-2 rounded-xl border border-[#E2E8F0] px-4 py-3">
                        {teams.filter((t) => t.id !== sanitizeTeamId(integrationTeamId)).length === 0 ? (
                          <p className="text-sm text-slate-500">No other teams available</p>
                        ) : (
                          teams
                            .filter((t) => t.id !== sanitizeTeamId(integrationTeamId))
                            .map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={sharedTeamIds.includes(t.id)}
                                  onChange={() => toggleSharedTeam(t.id)}
                                />
                                <span>{t.name}</span>
                              </label>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A]">API Key</label>
                    <input
                      type="password"
                      value={posApiKey}
                      onChange={(e) => setPosApiKey(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      required
                      placeholder="Pancake POS API key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A]">Description (optional)</label>
                    <textarea
                      value={posDescription}
                      onChange={(e) => setPosDescription(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      rows={2}
                      placeholder="Describe this store"
                    />
                  </div>

                  {posShops.length > 1 && (
                    <div>
                      <label className="block text-sm font-semibold text-[#0F172A]">Select Shop</label>
                      <select
                        value={posSelectedShopId}
                        onChange={(e) => setPosSelectedShopId(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      >
                        <option value="">Choose a shop</option>
                        {posShops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" type="button" onClick={closeModal}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
                      {isSubmitting ? 'Connecting...' : posShops.length > 1 ? 'Create Store' : 'Fetch Shops'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editIntegrationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#94A3B8]">Update Integration</p>
                <h2 className="text-xl font-semibold text-[#0F172A]">Assign Team</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={closeEditModal} iconLeft={<X className="h-4 w-4" />} />
            </div>
            <form onSubmit={handleEditTeamSubmit} className="space-y-4 px-6 py-4">
              <div>
                <label className="block text-sm font-semibold text-[#0F172A]">Team</label>
                <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  disabled={!isAdmin}
                  className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  {isAdmin && <option value="ALL_TEAMS">All teams (admin)</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {canShareIntegrations && (
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A]">Share with teams</label>
                  <div className="mt-2 space-y-2 rounded-xl border border-[#E2E8F0] px-4 py-3">
                    {teams.filter((t) => t.id !== sanitizeTeamId(editTeamId)).length === 0 ? (
                      <p className="text-sm text-slate-500">No other teams available</p>
                    ) : (
                      teams
                        .filter((t) => t.id !== sanitizeTeamId(editTeamId))
                        .map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={editSharedTeamIds.includes(t.id)}
                              onChange={() => toggleEditSharedTeam(t.id)}
                            />
                            <span>{t.name}</span>
                          </label>
                        ))
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={closeEditModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditSubmitting} loading={isEditSubmitting}>
                  {isEditSubmitting ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
