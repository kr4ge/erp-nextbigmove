'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelCreativeAiRun,
  fetchCreativeAiRun,
  fetchCreativeAiRuns,
  fetchCreativeAiConfig,
  startCreativeAiRun,
  updateCreativeAiHouseRules,
} from '../_services/creative-ai.service';
import type { CreativeAiConfig, CreativeAiEffort, CreativeAiProvider, CreativeAiRun, CreativeAiTarget } from '../_types/creative-ai';

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);
const MAX_LOCAL_VIDEO_BYTES = 250 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

type DateRange = { startDate: string; endDate: string };

export function useCreativeAiAnalysis({
  item,
  open,
  initialDateRange,
}: {
  item: CreativeAiTarget | null;
  open: boolean;
  initialDateRange: DateRange;
}) {
  const [video, setVideo] = useState<File | null>(null);
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [config, setConfig] = useState<CreativeAiConfig | null>(null);
  const [provider, setProvider] = useState<CreativeAiProvider>('CLAUDE');
  const [model, setModel] = useState('sonnet');
  const [effort, setEffort] = useState<CreativeAiEffort>('MEDIUM');
  const [runs, setRuns] = useState<CreativeAiRun[]>([]);
  const [activeRun, setActiveRun] = useState<CreativeAiRun | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async (creativeId: string) => {
    setIsLoadingRuns(true);
    try {
      const response = await fetchCreativeAiRuns(creativeId);
      setRuns(response.items);
      setActiveRun((current) => {
        if (current && response.items.some((run) => run.id === current.id)) {
          return response.items.find((run) => run.id === current.id) ?? current;
        }
        return response.items[0] ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load video analyses.');
    } finally {
      setIsLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !item) return;
    setVideo(null);
    setDateRange({
      startDate: initialDateRange.startDate,
      endDate: initialDateRange.endDate,
    });
    setRuns([]);
    setError(null);
    setActiveRun(null);
    void fetchCreativeAiConfig()
      .then((next) => {
        setConfig(next);
        setProvider(next.policy.defaultProvider);
        setModel(next.policy.defaultProvider === 'CLAUDE' ? next.policy.claudeModel : next.policy.codexModel);
        setEffort(next.policy.defaultEffort);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load AI provider settings.'));
    void loadRuns(item.id);
  }, [initialDateRange.endDate, initialDateRange.startDate, item, loadRuns, open]);

  const activeRunId = activeRun?.id ?? null;
  const activeRunStatus = activeRun?.status ?? null;

  useEffect(() => {
    if (!open || !activeRunId || !activeRunStatus || TERMINAL_STATUSES.has(activeRunStatus)) return;
    let disposed = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const refreshed = await fetchCreativeAiRun(activeRunId);
        if (disposed) return;
        setActiveRun(refreshed);
        setRuns((current) => [refreshed, ...current.filter((run) => run.id !== refreshed.id)]);
        setError(null);
        if (!TERMINAL_STATUSES.has(refreshed.status)) {
          timeoutId = window.setTimeout(poll, 1500);
        }
      } catch (pollError) {
        if (disposed) return;
        setError(pollError instanceof Error ? pollError.message : 'Unable to refresh analysis progress.');
        timeoutId = window.setTimeout(poll, 3000);
      }
    };

    timeoutId = window.setTimeout(poll, 1000);
    return () => {
      disposed = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [activeRunId, activeRunStatus, open]);

  const isStatic = item?.kind === 'STATIC';
  const allowedExtensions = isStatic ? ALLOWED_IMAGE_EXTENSIONS : ALLOWED_VIDEO_EXTENSIONS;

  const chooseVideo = useCallback((file: File | null) => {
    setError(null);
    if (!file) {
      setVideo(null);
      return;
    }
    const name = file.name.toLowerCase();
    if (!allowedExtensions.some((extension) => name.endsWith(extension))) {
      setVideo(null);
      setError(isStatic ? 'Choose a JPG, PNG, or WebP image.' : 'Choose an MP4, MOV, M4V, or WebM video.');
      return;
    }
    if (file.size > MAX_LOCAL_VIDEO_BYTES) {
      setVideo(null);
      setError('The selected video exceeds the 250 MB local limit.');
      return;
    }
    setVideo(file);
  }, [allowedExtensions, isStatic]);

  const start = useCallback(async () => {
    if (!item || !video) {
      setError(isStatic ? 'Choose the image file before starting the analysis.' : 'Choose the local video file before starting the analysis.');
      return;
    }
    if (dateRange.startDate > dateRange.endDate) {
      setError('The start date must be before or equal to the end date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const run = await startCreativeAiRun({
        creativeId: item.id,
        video,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        provider,
        model,
        effort,
      });
      setActiveRun(run);
      setRuns((current) => [run, ...current.filter((entry) => entry.id !== run.id)]);
      setVideo(null);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start video analysis.');
    } finally {
      setIsSubmitting(false);
    }
  }, [dateRange.endDate, dateRange.startDate, effort, isStatic, item, model, provider, video]);

  const cancel = useCallback(async () => {
    if (!activeRun || TERMINAL_STATUSES.has(activeRun.status)) return;
    setIsCancelling(true);
    setError(null);
    try {
      const run = await cancelCreativeAiRun(activeRun.id);
      setActiveRun(run);
      setRuns((current) => [run, ...current.filter((entry) => entry.id !== run.id)]);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel the video analysis.');
    } finally {
      setIsCancelling(false);
    }
  }, [activeRun]);

  // House rules are edited in place from the run dialog by whoever manages
  // creative performance, so the advertiser never has to leave the screen.
  const savePromptRules = useCallback(async (houseRules: string) => {
    setIsSavingPrompt(true);
    setError(null);
    try {
      const saved = await updateCreativeAiHouseRules(houseRules);
      setConfig((current) => current ? { ...current, prompt: { ...current.prompt, ...saved } } : current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the analysis house rules.');
    } finally {
      setIsSavingPrompt(false);
    }
  }, []);

  const selectedProvider = useMemo(
    () => config?.providers.find((entry) => entry.provider === provider) ?? null,
    [config, provider],
  );
  const availableModels = useMemo(() => selectedProvider?.models ?? [], [selectedProvider]);
  const selectedModel = useMemo(
    () => availableModels.find((entry) => entry.id === model) ?? availableModels[0] ?? null,
    [availableModels, model],
  );
  const availableEfforts = useMemo(() => selectedModel?.supportedEfforts ?? [], [selectedModel]);

  const chooseProvider = useCallback((nextProvider: CreativeAiProvider) => {
    setProvider(nextProvider);
    const status = config?.providers.find((entry) => entry.provider === nextProvider);
    const configured = nextProvider === 'CLAUDE' ? config?.policy.claudeModel : config?.policy.codexModel;
    const nextModel = status?.models.find((entry) => entry.id === configured) ?? status?.models[0];
    if (nextModel) {
      setModel(nextModel.id);
      setEffort(nextModel.supportedEfforts.includes(effort) ? effort : nextModel.defaultEffort);
    }
  }, [config, effort]);

  const chooseModel = useCallback((nextModelId: string) => {
    setModel(nextModelId);
    const nextModel = availableModels.find((entry) => entry.id === nextModelId);
    if (nextModel && !nextModel.supportedEfforts.includes(effort)) setEffort(nextModel.defaultEffort);
  }, [availableModels, effort]);

  const selectRun = useCallback((runId: string) => {
    setActiveRun(runs.find((run) => run.id === runId) ?? null);
    setError(null);
  }, [runs]);

  const isRunning = Boolean(activeRun && !TERMINAL_STATUSES.has(activeRun.status));
  const canStart = Boolean(video && !isSubmitting && !isRunning && selectedProvider?.connected && model);

  return useMemo(() => ({
    video,
    dateRange,
    config,
    provider,
    model,
    effort,
    selectedProvider,
    availableModels,
    availableEfforts,
    runs,
    activeRun,
    isLoadingRuns,
    isSubmitting,
    isCancelling,
    isSavingPrompt,
    isStatic,
    isRunning,
    canStart,
    error,
    setDateRange,
    chooseProvider,
    chooseModel,
    setEffort,
    chooseVideo,
    selectRun,
    start,
    cancel,
    savePromptRules,
  }), [
    activeRun,
    cancel,
    canStart,
    chooseVideo,
    dateRange,
    error,
    isCancelling,
    isSavingPrompt,
    isStatic,
    savePromptRules,
    isLoadingRuns,
    isRunning,
    isSubmitting,
    config,
    provider,
    model,
    effort,
    selectedProvider,
    availableModels,
    availableEfforts,
    chooseProvider,
    chooseModel,
    runs,
    selectRun,
    start,
    video,
  ]);
}
