'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { workflowsService } from '../_services/workflows.service';
import type { WorkflowItem } from '../_types/workflow';
import type { WorkflowMetaIntegrationOption } from '../_types/manual-meta-upload';
import { parseWorkflowError } from '../_utils/workflow-errors';
import { parseManualMetaUploadFile } from '../_utils/meta-upload-parser';

export function useWorkflowsController() {
  const router = useRouter();
  const { addToast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningById, setRunningById] = useState<Record<string, boolean>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [metaIntegrations, setMetaIntegrations] = useState<WorkflowMetaIntegrationOption[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploadingMeta, setIsUploadingMeta] = useState(false);

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

  const fetchMetaIntegrations = useCallback(async () => {
    try {
      const data = await workflowsService.fetchMetaIntegrations();
      setMetaIntegrations(data);
      setSelectedIntegrationId((prev) =>
        prev && data.some((integration) => integration.id === prev) ? prev : '',
      );
    } catch (fetchError) {
      addToast('error', parseWorkflowError(fetchError, 'Failed to load Meta integrations'));
    }
  }, [addToast]);

  useEffect(() => {
    void fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    void fetchTeamNameMap();
  }, [fetchTeamNameMap]);

  useEffect(() => {
    void fetchMetaIntegrations();
  }, [fetchMetaIntegrations]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'current_team_ids' || event.key === 'current_team_id') {
        void fetchWorkflows();
        void fetchMetaIntegrations();
      }
    };
    const onTeamScope = () => {
      void fetchWorkflows();
      void fetchMetaIntegrations();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
    };
  }, [fetchMetaIntegrations, fetchWorkflows]);

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

  const openUploadModal = useCallback(() => {
    setShowUploadModal(true);
  }, []);

  const closeUploadModal = useCallback(() => {
    if (isUploadingMeta) return;
    setShowUploadModal(false);
    setSelectedUploadFile(null);
  }, [isUploadingMeta]);

  const handleUploadMeta = useCallback(async () => {
    if (!selectedUploadFile) {
      addToast('error', 'Select a CSV or XLSX file to upload');
      return;
    }

    setIsUploadingMeta(true);
    try {
      const rows = await parseManualMetaUploadFile(selectedUploadFile);
      const response = await workflowsService.uploadManualMeta({
        integrationId: selectedIntegrationId || undefined,
        rows,
      });

      addToast('success', `Populated ${response.insightsUpserted} Meta ad insights`, 5000);
      window.setTimeout(() => {
        addToast(
          'success',
          `Reconcile marketing completed for ${response.datesProcessed.length} date(s)`,
          5000,
        );
      }, 150);
      window.setTimeout(() => {
        addToast(
          'success',
          `Reconcile sales completed for ${response.datesProcessed.length} date(s)`,
          5000,
        );
      }, 300);

      setShowUploadModal(false);
      setSelectedUploadFile(null);
    } catch (uploadError) {
      addToast('error', parseWorkflowError(uploadError, 'Failed to upload Meta ads manually'), 6000);
    } finally {
      setIsUploadingMeta(false);
    }
  }, [addToast, selectedIntegrationId, selectedUploadFile]);

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
    metaIntegrations,
    showUploadModal,
    selectedIntegrationId,
    selectedUploadFile,
    isUploadingMeta,
    fetchWorkflows,
    handleRunWorkflow,
    openUploadModal,
    closeUploadModal,
    setSelectedIntegrationId,
    setSelectedUploadFile,
    handleUploadMeta,
    navigateToNew,
    navigateToView,
    navigateToSettings,
  };
}
