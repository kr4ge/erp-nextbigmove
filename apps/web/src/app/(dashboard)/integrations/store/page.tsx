'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import { Store } from 'lucide-react';

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

interface StoreCard {
  id: string;
  name: string;
  shopName?: string;
  shopAvatarUrl?: string;
  description?: string;
  shopId?: string;
  status?: string;
  enabled?: boolean;
  teamId?: string | null;
}

export default function StorePage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  // We keep the setter to react to external scope changes even if we don't render the current selection here.
  const [, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    fetchStores();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'current_team_ids' || e.key === 'current_team_id') {
        setSelectedTeamIds(getSelectedTeamIds());
        fetchStores();
      }
    };
    const onTeamScope = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const arr = Array.isArray(detail) ? detail : [];
      setSelectedTeamIds(arr);
      fetchStores();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, []);

  useEffect(() => {
    setSelectedTeamIds(getSelectedTeamIds());
    // Fetch team names for badges - try my-teams first (no permission required), then teams for admins
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

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized');
        setIsLoading(false);
        return;
      }

      const response = await apiClient.get('/integrations/pos-stores', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setStores(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load stores');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (title: string) => {
    if (!title) return 'S';
    return title
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className="py-12 text-center text-[#475569]">
        Loading stores...
      </Card>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="POS Stores"
          description="View and manage your connected Pancake POS stores."
        />
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Stores"
        description="View and manage your connected Pancake POS stores."
      />

      {stores.length === 0 ? (
        <EmptyState
          title="No POS stores connected"
          description="Connect your first store to see it listed here."
          actionLabel="Connect Store"
          onAction={() => router.push('/integrations/create?provider=PANCAKE_POS')}
          icon={<Store className="h-8 w-8" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => {
            const displayName = store.shopName || store.name;

            return (
              <Card
                key={store.id}
                className="flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full bg-[#FEF2F2] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#EF4444]">
                    Shop
                  </span>
                  <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]">
                    {store.teamId
                      ? `Team: ${teamNames[store.teamId] || store.teamId}`
                      : 'All teams'}
                  </span>
                </div>

                <div className="mt-6 flex flex-col items-center text-center">
                  {store.shopAvatarUrl ? (
                    <img
                      src={store.shopAvatarUrl}
                      alt={displayName}
                      className="h-16 w-16 rounded-full border border-[#E2E8F0] object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F5F9] text-xl font-semibold text-[#475569]">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">{displayName}</h3>
                  <p className="mt-1 text-sm text-[#475569]">Pancake POS</p>
                  {store.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[#94A3B8]">{store.description}</p>
                  )}
                  {store.shopId && (
                    <p className="mt-2 text-xs text-[#94A3B8]">Shop ID: {store.shopId}</p>
                  )}
                </div>

                <div className="mt-6">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => router.push(`/integrations/store/${store.id}`)}
                  >
                    Enter
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
