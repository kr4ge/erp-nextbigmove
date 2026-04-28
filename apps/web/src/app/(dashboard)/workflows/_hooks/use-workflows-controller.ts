'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { workflowsService } from '../_services/workflows.service';
import type { WorkflowItem } from '../_types/workflow';
import type {
  WorkflowManualMetaUploadJobStatus,
  WorkflowMetaIntegrationOption,
} from '../_types/manual-meta-upload';
import { parseWorkflowError } from '../_utils/workflow-errors';

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
  const [manualUploadJob, setManualUploadJob] = useState<WorkflowManualMetaUploadJobStatus | null>(
    null,
  );
  const [manualUploadError, setManualUploadError] = useState<string | null>(null);

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
    setManualUploadJob(null);
    setManualUploadError(null);
  }, [isUploadingMeta]);

  const handleUploadMeta = useCallback(async () => {
    if (!selectedUploadFile) {
      addToast('error', 'Select a CSV or XLSX file to upload');
      return;
    }

    setIsUploadingMeta(true);
    setManualUploadError(null);
    setManualUploadJob(null);

    try {
      const { jobId } = await workflowsService.uploadManualMetaFile({
        integrationId: selectedIntegrationId || undefined,
        file: selectedUploadFile,
      });

      const pollIntervalMs = 1500;
      const maxPollMs = 1000 * 60 * 30;
      const startedAt = Date.now();

      while (Date.now() - startedAt < maxPollMs) {
        const status = await workflowsService.fetchManualMetaUploadJobStatus(jobId);
        setManualUploadJob(status);

        if (status.state === 'completed') {
          const result = status.result;
          if (result) {
            addToast('success', `Populated ${result.insightsUpserted} Meta ad insights`, 5000);
            window.setTimeout(() => {
              addToast(
                'success',
                `Reconcile marketing completed for ${result.datesProcessed.length} date(s)`,
                5000,
              );
            }, 150);
            window.setTimeout(() => {
              addToast(
                'success',
                `Reconcile sales completed for ${result.datesProcessed.length} date(s)`,
                5000,
              );
            }, 300);
          } else {
            addToast('success', 'Meta upload completed', 5000);
          }

          setShowUploadModal(false);
          setSelectedUploadFile(null);
          setManualUploadJob(null);
          return;
        }

        if (status.state === 'failed') {
          const failedMessage =
            status.failedReason || status.progress?.failedReason || 'Failed to upload Meta ads manually';
          setManualUploadError(failedMessage);
          addToast('error', failedMessage, 6000);
          return;
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, pollIntervalMs);
        });
      }

      const timeoutMessage = 'Upload is taking too long. Please check again in a few minutes.';
      setManualUploadError(timeoutMessage);
      addToast('error', timeoutMessage, 6000);
    } catch (uploadError) {
      const message = parseWorkflowError(uploadError, 'Failed to upload Meta ads manually');
      setManualUploadError(message);
      addToast('error', message, 6000);
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
    manualUploadJob,
    manualUploadError,
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
