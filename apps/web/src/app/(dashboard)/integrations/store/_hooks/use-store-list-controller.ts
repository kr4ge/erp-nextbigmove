'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTeamNameMap } from '../../_services/team.service';
import { storeListService } from '../_services/store-list.service';
import type { StoreCard } from '../_types/store-list';
import { filterStores, STORE_PAGE_SIZE } from '../_utils/store-list';

type FetchStoresOptions = {
  silent?: boolean;
};

type ApiLikeError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

function parseStoreError(error: unknown) {
  const apiError = error as ApiLikeError;
  return apiError.response?.data?.message || apiError.message || 'Failed to load stores';
}

export function useStoreListController() {
  const router = useRouter();

  const [allStores, setAllStores] = useState<StoreCard[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  const filteredStores = useMemo(
    () => filterStores(allStores, searchTerm),
    [allStores, searchTerm],
  );

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredStores.length / STORE_PAGE_SIZE)),
    [filteredStores.length],
  );

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const visibleStores = useMemo(() => {
    const safePage = Math.min(page, pageCount);
    const start = (safePage - 1) * STORE_PAGE_SIZE;
    return filteredStores.slice(start, start + STORE_PAGE_SIZE);
  }, [filteredStores, page, pageCount]);

  const fetchStores = useCallback(
    async ({ silent = false }: FetchStoresOptions = {}) => {
      try {
        if (silent) {
          setIsFetching(true);
        } else {
          setIsLoading(true);
        }
        setError('');

        const stores = await storeListService.fetchStores();
        setAllStores(stores);
      } catch (fetchError) {
        setError(parseStoreError(fetchError));
      } finally {
        if (silent) {
          setIsFetching(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchStores({ silent: false });
  }, [fetchStores]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setTeamNames(await fetchTeamNameMap());
      } catch {
        setTeamNames({});
      }
    };
    void fetchTeams();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'current_team_ids' || event.key === 'current_team_id') {
        void fetchStores({ silent: true });
      }
    };
    const onTeamScope = () => {
      void fetchStores({ silent: true });
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, [fetchStores]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  }, []);

  const openStore = useCallback(
    (storeId: string) => {
      router.push(`/integrations/store/${storeId}`);
    },
    [router],
  );

  const goToConnectStore = useCallback(() => {
    router.push('/integrations/create?provider=PANCAKE_POS');
  }, [router]);

  return {
    isLoading,
    isFetching,
    error,
    searchInput,
    setSearchInput,
    searchTerm,
    page,
    setPage,
    pageCount,
    teamNames,
    filteredStores,
    visibleStores,
    total: filteredStores.length,
    clearSearch,
    openStore,
    goToConnectStore,
  };
}
