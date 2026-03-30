'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { workflowsService } from '../_services/workflows.service';
import type { WorkflowItem } from '../_types/workflow';
import { parseWorkflowError } from '../_utils/workflow-errors';

export function useWorkflowsController() {
  const router = useRouter();
  const { addToast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningById, setRunningById] = useState<Record<string, boolean>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  const fetchWorkflows = useCallback(async () => {
    try {
      setError(null);
      const data = await workflowsService.fetchWorkflows();
      setWorkflows(data);
    } catch (fetchError) {
      setError(parseWorkflowError(fetchError, 'Failed to fetch workflows'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTeamNameMap = useCallback(async () => {
    try {
      const nextTeamNames = await workflowsService.fetchTeamNameMap();
      setTeamNames(nextTeamNames);
    } catch {
      setTeamNames({});
    }
  }, []);

  useEffect(() => {
    void fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    void fetchTeamNameMap();
  }, [fetchTeamNameMap]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'current_team_ids' || event.key === 'current_team_id') {
        void fetchWorkflows();
      }
    };
    const onTeamScope = () => {
      void fetchWorkflows();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, [fetchWorkflows]);

  const handleRunWorkflow = useCallback(
    async (workflowId: string) => {
      if (runningById[workflowId]) return;

      setRunningById((prev) => ({ ...prev, [workflowId]: true }));
      try {
        await workflowsService.triggerWorkflow(workflowId);
        router.push(`/workflows/${workflowId}`);
      } catch (runError) {
        addToast('error', parseWorkflowError(runError, 'Failed to trigger workflow'));
      } finally {
        setRunningById((prev) => ({ ...prev, [workflowId]: false }));
      }
    },
    [addToast, router, runningById],
  );

  const navigateToNew = useCallback(() => {
    router.push('/workflows/new');
  }, [router]);

  const navigateToView = useCallback(
    (workflow: WorkflowItem) => {
      router.push(`/workflows/${workflow.id}`);
    },
    [router],
  );

  const navigateToSettings = useCallback(
    (workflow: WorkflowItem) => {
      router.push(`/workflows/${workflow.id}/edit`);
    },
    [router],
  );

  return {
    workflows,
    isLoading,
    error,
    runningById,
    teamNames,
    fetchWorkflows,
    handleRunWorkflow,
    navigateToNew,
    navigateToView,
    navigateToSettings,
  };
}
