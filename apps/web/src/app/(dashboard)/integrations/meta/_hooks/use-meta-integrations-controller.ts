'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTeamNameMap } from '../../_services/team.service';
import { metaIntegrationsService } from '../_services/meta-integrations.service';
import type { MetaIntegration } from '../_types/meta-integration';
import { parseMetaIntegrationError } from '../_utils/meta-integrations';

type ConfirmFn = (message?: string) => boolean;
type AlertFn = (message?: string) => void;

interface MetaIntegrationsControllerOptions {
  confirmImpl?: ConfirmFn;
  alertImpl?: AlertFn;
}

export function useMetaIntegrationsController(
  options: MetaIntegrationsControllerOptions = {},
) {
  const router = useRouter();
  const confirmImpl = useMemo(
    () => options.confirmImpl ?? ((message?: string) => window.confirm(message)),
    [options.confirmImpl],
  );
  const alertImpl = useMemo(
    () => options.alertImpl ?? ((message?: string) => window.alert(message)),
    [options.alertImpl],
  );

  const [integrations, setIntegrations] = useState<MetaIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  const fetchIntegrations = useCallback(async () => {
    try {
      setError('');
      const list = await metaIntegrationsService.fetchAll();
      setIntegrations(list);
    } catch (fetchError) {
      const message = parseMetaIntegrationError(
        fetchError,
        'Failed to load Meta integrations',
      );
      if (message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'current_team_ids' || event.key === 'current_team_id') {
        void fetchIntegrations();
      }
    };
    const onTeamScope = () => {
      void fetchIntegrations();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, [fetchIntegrations]);

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

  const openDetail = useCallback(
    (id: string) => {
      router.push(`/integrations/meta/${id}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = confirmImpl('Are you sure you want to delete this Meta integration?');
      if (!confirmed) return;

      try {
        await metaIntegrationsService.remove(id);
        await fetchIntegrations();
      } catch (deleteError) {
        alertImpl(
          `Failed to delete integration: ${parseMetaIntegrationError(
            deleteError,
            'Unknown error',
          )}`,
        );
      }
    },
    [alertImpl, confirmImpl, fetchIntegrations],
  );

  return {
    integrations,
    isLoading,
    error,
    teamNames,
    openDetail,
    handleDelete,
  };
}
