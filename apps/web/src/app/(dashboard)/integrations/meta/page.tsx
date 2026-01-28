'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/emptystate';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/ui/page-header';

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

interface MetaIntegration {
  id: string;
  name: string;
  provider: string;
  status: string;
  enabled: boolean;
  config: any;
  createdAt: string;
  updatedAt: string;
  teamId?: string | null;
}

export default function MetaPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<MetaIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  useEffect(() => {
    const selected = getSelectedTeamIds();
    setSelectedTeamIds(selected);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'current_team_ids' || e.key === 'current_team_id') {
        const next = getSelectedTeamIds();
        setSelectedTeamIds(next);
        fetchIntegrations();
      }
    };
    const onTeamScope = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const arr = Array.isArray(detail) ? detail : [];
      setSelectedTeamIds(arr);
      fetchIntegrations();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, []);

  useEffect(() => {
    // Fetch team names to display friendly labels on cards - try my-teams first (no permission required)
    const fetchTeams = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (!token) return;
        const res = await apiClient
          .get('/teams/my-teams', { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => apiClient.get('/teams', { headers: { Authorization: `Bearer ${token}` } }));
        const teams = res?.data || [];
        const map: Record<string, string> = {};
        teams.forEach((t: any) => {
          if (t.id && t.name) map[t.id] = t.name;
        });
        setTeamNames(map);
      } catch {
        setTeamNames({});
      }
    };
    fetchTeams();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await apiClient.get('/integrations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const metaIntegrations = response.data.filter((i: any) => i.provider === 'META_ADS');
      setIntegrations(metaIntegrations);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load Meta integrations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Meta integration?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      await apiClient.delete(`/integrations/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await fetchIntegrations();
    } catch (err: any) {
      alert('Failed to delete integration: ' + (err.response?.data?.message || 'Unknown error'));
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-600 ring-emerald-200';
      case 'ERROR':
        return 'bg-rose-50 text-rose-600 ring-rose-200';
      case 'PENDING':
        return 'bg-amber-50 text-amber-600 ring-amber-200';
      case 'DISABLED':
        return 'bg-slate-50 text-slate-600 ring-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 ring-slate-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card className="text-center text-[#475569]">Loading Meta integrations...</Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meta Integrations"
        description="View and manage your Meta connections. Add new integrations from the main Integrations page."
      />

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <EmptyState
          title="No Meta integrations found"
          description="Add Meta integrations from the Integrations page to see them here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <Card
              key={integration.id}
              className="cursor-pointer transition hover:shadow-md"
              onClick={() => router.push(`/integrations/meta/${integration.id}`)}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#0F172A]">{integration.name}</h3>
                    <p className="text-sm text-[#475569]">Meta Marketing API</p>
                    <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {integration.teamId
                        ? `Team: ${teamNames[integration.teamId] || integration.teamId}`
                        : 'All teams'}
                    </span>
                  </div>
                </div>
                <StatusBadge status={(integration.status as any) || 'ACTIVE'} />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-[#E2E8F0] pt-3">
                <div>
                  <p className="text-xs text-[#475569]">Created</p>
                  <p className="text-sm text-[#0F172A]">{formatDate(integration.createdAt)}</p>
                </div>
                <div />
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/integrations/meta/${integration.id}`);
                  }}
                >
                  View Details
                </Button>
                <Button
                  variant="ghost"
                  className="text-[#EF4444]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(integration.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
