'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/emptystate';
import { Store, Search } from 'lucide-react';

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
  const [allStores, setAllStores] = useState<StoreCard[]>([]);
  const [filteredStores, setFilteredStores] = useState<StoreCard[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; pageCount: number }>({
    total: 0,
    page: 1,
    limit: 12,
    pageCount: 1,
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  // We keep the setter to react to external scope changes even if we don't render the current selection here.
  const [, setSelectedTeamIds] = useState<string[]>([]);

  useEffect(() => {
    fetchStores({ silent: !(page === 1 && searchTerm === '') });
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'current_team_ids' || e.key === 'current_team_id') {
        setSelectedTeamIds(getSelectedTeamIds());
        fetchStores({ silent: true });
      }
    };
    const onTeamScope = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const arr = Array.isArray(detail) ? detail : [];
      setSelectedTeamIds(arr);
      fetchStores({ silent: true });
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

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      const term = searchInput.trim();
      setPage(1);
      setSearchTerm(term);
    }, 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Filter locally when search changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredStores(allStores);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredStores(
        allStores.filter((store) => {
          const name = store.name?.toLowerCase() || '';
          const shopName = store.shopName?.toLowerCase() || '';
          const shopId = store.shopId?.toLowerCase() || '';
          const desc = store.description?.toLowerCase() || '';
          return (
            name.includes(term) ||
            shopName.includes(term) ||
            shopId.includes(term) ||
            desc.includes(term)
          );
        }),
      );
    }
    setPage(1);
  }, [searchTerm, allStores]);

  // Recompute pagination meta when filtered list or page changes
  useEffect(() => {
    const total = filteredStores.length;
    const limit = meta.limit;
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pageCount);
    setPage(safePage);
    setMeta((prev) => ({ ...prev, total, page: safePage, pageCount }));
  }, [filteredStores, page, meta.limit]);

  const fetchStores = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (silent) {
        setIsFetching(true);
      } else {
        setIsLoading(true);
      }
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized');
        setIsLoading(false);
        setIsFetching(false);
        return;
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const scopeIds = getSelectedTeamIds();
      if (scopeIds.length > 0) {
        headers['X-Team-Id'] = scopeIds.join(',');
      }

      const response = await apiClient.get('/integrations/pos-stores', {
        headers: {
          ...headers,
        },
      });

      const payload = response.data;
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      setAllStores(list || []);
      setFilteredStores(list || []);
      // reset paging meta
      const total = list?.length || 0;
      const limit = 12;
      const pageCount = Math.max(1, Math.ceil(total / limit));
      setMeta({ total, page: 1, limit, pageCount });
      setPage(1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load stores');
    } finally {
      if (silent) {
        setIsFetching(false);
      } else {
        setIsLoading(false);
      }
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search stores"
            className="w-full rounded-xl border border-[#D5DAE0] bg-[#EEF1F5] px-4 py-2.5 pr-10 text-sm text-[#334155] placeholder:text-[#94A3B8] outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/30"
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        </div>
      </div>

      {filteredStores.length === 0 ? (
        searchTerm ? (
          <Card className="flex flex-col items-center justify-center gap-3 px-8 py-12 text-center">
            <div className="text-lg font-semibold text-[#0F172A]">No results for “{searchInput || searchTerm}”</div>
            <p className="text-sm text-[#475569]">Try a different keyword or clear the search to see all stores.</p>
            <Button variant="ghost" onClick={() => { setSearchInput(''); setPage(1); }}>
              Clear search
            </Button>
          </Card>
        ) : (
          <EmptyState
            title="No POS stores connected"
            description="Connect your first store to see it listed here."
            actionLabel="Connect Store"
            onAction={() => router.push('/integrations/create?provider=PANCAKE_POS')}
            icon={<Store className="h-8 w-8" />}
          />
        )
      ) : (
        <>
          {isFetching && (
            <div className="text-sm text-[#475569]">Updating results...</div>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredStores
              .slice((meta.page - 1) * meta.limit, meta.page * meta.limit)
              .map((store) => {
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

          {meta && meta.pageCount > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#475569]">
              <div>Showing page {meta.page} of {meta.pageCount}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={meta.page >= meta.pageCount}
                  onClick={() => setPage((p) => Math.min(meta.pageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
