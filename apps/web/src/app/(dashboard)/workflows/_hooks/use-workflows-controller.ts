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
import { DEFAULT_CURRENCY_MULTIPLIER } from '../_utils/meta-upload-currency';
import {
  buildPendingUploads,
  mismatchedCurrencyFiles,
  type PendingMetaUpload,
} from '../_utils/meta-upload-queue';

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
  const [manualCurrency, setManualCurrency] = useState<'PHP' | 'USD'>('PHP');
  const [manualCurrencyMultiplier, setManualCurrencyMultiplier] = useState(DEFAULT_CURRENCY_MULTIPLIER);
  const [pendingUploads, setPendingUploads] = useState<PendingMetaUpload[]>([]);
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
    setPendingUploads([]);
    setManualCurrency('PHP');
    setManualCurrencyMultiplier(DEFAULT_CURRENCY_MULTIPLIER);
    setManualUploadJob(null);
    setManualUploadError(null);
  }, [isUploadingMeta]);

  const addPendingUploads = useCallback(async (files: File[]) => {
    const inspected = await buildPendingUploads(files);
    // Re-picking the same file replaces its entry rather than duplicating it.
    setPendingUploads((current) => {
      const next = [...current];
      for (const item of inspected) {
        const existing = next.findIndex((entry) => entry.id === item.id);
        if (existing >= 0) next[existing] = item;
        else next.push(item);
      }
      return next;
    });
  }, []);

  const removePendingUpload = useCallback((id: string) => {
    setPendingUploads((current) => current.filter((entry) => entry.id !== id));
  }, []);

  /**
   * Uploads one file and polls until its job settles.
   *
   * Resolves with the terminal outcome instead of throwing, so one bad export
   * in a batch does not abandon the files queued behind it.
   */
  const uploadOneMetaFile = useCallback(async (
    file: File,
    multiplier: number | undefined,
  ): Promise<{ ok: true; insights: number; dates: number } | { ok: false; message: string }> => {
    try {
      const { jobId } = await workflowsService.uploadManualMetaFile({
        integrationId: selectedIntegrationId || undefined,
        currencyMultiplier: multiplier,
        file,
      });

      const pollIntervalMs = 1500;
      const maxPollMs = 1000 * 60 * 30;
      const startedAt = Date.now();

      while (Date.now() - startedAt < maxPollMs) {
        const status = await workflowsService.fetchManualMetaUploadJobStatus(jobId);
        setManualUploadJob(status);

        if (status.state === 'completed') {
          const result = status.result;
          return {
            ok: true,
            insights: result?.insightsUpserted ?? 0,
            dates: result?.datesProcessed.length ?? 0,
          };
        }

        if (status.state === 'failed') {
          return {
            ok: false,
            message: status.failedReason
              || status.progress?.failedReason
              || 'Failed to upload Meta ads manually',
          };
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, pollIntervalMs);
        });
      }

      return { ok: false, message: 'Upload is taking too long. Please check again in a few minutes.' };
    } catch (uploadError) {
      return { ok: false, message: parseWorkflowError(uploadError, 'Failed to upload Meta ads manually') };
    }
  }, [selectedIntegrationId]);

  const handleUploadMeta = useCallback(async () => {
    if (!pendingUploads.length) {
      addToast('error', 'Add at least one CSV or XLSX file to upload');
      return;
    }

    // The rate only reaches files whose header declares a non-PHP currency;
    // the server forces 1 for PHP, so sending it for every file is harmless.
    const multiplier = manualCurrency === 'USD' && manualCurrencyMultiplier
      ? Number(manualCurrencyMultiplier)
      : undefined;
    if (manualCurrency === 'USD' && (!multiplier || multiplier <= 0)) {
      addToast('error', 'Enter a positive conversion rate for USD files');
      return;
    }

    // A non-PHP file with PHP selected would reach the server with no rate and
    // be rejected mid-batch; stop it here so nothing is imported half-way.
    const contradicting = mismatchedCurrencyFiles(pendingUploads, manualCurrency)
      .filter((item) => item.currency !== 'PHP');
    if (contradicting.length > 0) {
      addToast('error', `Switch to USD or re-export: ${contradicting.map((item) => item.file.name).join(', ')} reports a non-PHP currency`, 6000);
      return;
    }

    setIsUploadingMeta(true);
    setManualUploadError(null);
    setManualUploadJob(null);

    let totalInsights = 0;
    let totalDates = 0;
    let failures = 0;

    try {
      for (const item of pendingUploads) {
        if (item.status === 'done') continue;
        setPendingUploads((current) => current.map((entry) =>
          entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry));

        const outcome = await uploadOneMetaFile(item.file, multiplier);

        setPendingUploads((current) => current.map((entry) => entry.id === item.id
          ? outcome.ok
            ? { ...entry, status: 'done' as const, error: undefined }
            : { ...entry, status: 'failed' as const, error: outcome.message }
          : entry));

        if (outcome.ok) {
          totalInsights += outcome.insights;
          totalDates += outcome.dates;
        } else {
          failures += 1;
          setManualUploadError(outcome.message);
        }
      }

      if (totalInsights > 0) {
        addToast('success', `Populated ${totalInsights} Meta ad insights across ${totalDates} date(s)`, 5000);
      }
      if (failures > 0) {
        addToast('error', `${failures} file(s) failed. Fix them and upload again.`, 6000);
      } else {
        setShowUploadModal(false);
        setPendingUploads([]);
        setManualCurrency('PHP');
    setManualCurrencyMultiplier(DEFAULT_CURRENCY_MULTIPLIER);
        setManualUploadJob(null);
      }
    } finally {
      setIsUploadingMeta(false);
    }
  }, [addToast, manualCurrency, manualCurrencyMultiplier, pendingUploads, uploadOneMetaFile]);

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
    pendingUploads,
    addPendingUploads,
    removePendingUpload,
    manualCurrency,
    setManualCurrency,
    manualCurrencyMultiplier,
    isUploadingMeta,
    manualUploadJob,
    manualUploadError,
    fetchWorkflows,
    handleRunWorkflow,
    openUploadModal,
    closeUploadModal,
    setSelectedIntegrationId,
    setManualCurrencyMultiplier,
    handleUploadMeta,
    navigateToNew,
    navigateToView,
    navigateToSettings,
  };
}
