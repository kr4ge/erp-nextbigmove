'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { CREATIVE_AI_UI_ENABLED } from '@/lib/creative-ai-feature';
import {
  fetchCreativeAiConfig,
  fetchCreativeAiProviderLogin,
  logoutCreativeAiProvider,
  startCreativeAiProviderLogin,
  submitCreativeAiProviderLoginCode,
  testCreativeAiProvider,
  updateCreativeAiConfig,
} from '@/app/(dashboard)/creative-agent/video-registry/_services/creative-ai.service';
import type {
  CreativeAiConfig,
  CreativeAiEffort,
  CreativeAiProvider,
  CreativeAiProviderLogin,
  UpdateCreativeAiConfigInput,
} from '@/app/(dashboard)/creative-agent/video-registry/_types/creative-ai';

const EMPTY_POLICY: UpdateCreativeAiConfigInput = {
  defaultProvider: 'CLAUDE',
  claudeModel: 'sonnet',
  codexModel: 'gpt-5.6-terra',
  defaultEffort: 'MEDIUM',
  maxTurns: 12,
  maxBudgetUsd: 1,
  allowRunOverrides: true,
};

export function useAiSettingsController() {
  const { addToast } = useToast();
  const [config, setConfig] = useState<CreativeAiConfig | null>(null);
  const [draft, setDraft] = useState<UpdateCreativeAiConfigInput>(EMPTY_POLICY);
  const [loading, setLoading] = useState(CREATIVE_AI_UI_ENABLED);
  const [saving, setSaving] = useState(false);
  const [busyProvider, setBusyProvider] = useState<CreativeAiProvider | null>(null);
  const [loginProvider, setLoginProvider] = useState<CreativeAiProvider | null>(null);
  const [login, setLogin] = useState<CreativeAiProviderLogin | null>(null);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [error, setError] = useState<string | null>(
    CREATIVE_AI_UI_ENABLED ? null : 'Creative AI is enabled only in the local development environment.',
  );

  const load = useCallback(async () => {
    if (!CREATIVE_AI_UI_ENABLED) {
      setConfig(null);
      setLoading(false);
      setError('Creative AI is enabled only in the local development environment.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCreativeAiConfig();
      setConfig(next);
      setDraft({
        defaultProvider: next.policy.defaultProvider,
        claudeModel: next.policy.claudeModel,
        codexModel: next.policy.codexModel,
        defaultEffort: next.policy.defaultEffort,
        maxTurns: next.policy.maxTurns,
        maxBudgetUsd: next.policy.maxBudgetUsd,
        allowRunOverrides: next.policy.allowRunOverrides,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load AI settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!loginProvider || !login?.loginId || login.status !== 'WAITING') return;
    let disposed = false;
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchCreativeAiProviderLogin(loginProvider, login.loginId as string);
        if (disposed) return;
        setLogin(next);
        if (next.status === 'CONNECTED') {
          window.clearInterval(timer);
          addToast('success', `${loginProvider === 'CLAUDE' ? 'Claude' : 'Codex'} is connected.`);
          await load();
        }
        if (next.status === 'FAILED') window.clearInterval(timer);
      } catch (pollError) {
        if (!disposed) setError(pollError instanceof Error ? pollError.message : 'Unable to check sign-in progress.');
      }
    }, 1500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [addToast, load, login?.loginId, login?.status, loginProvider]);

  const startLogin = useCallback(async (provider: CreativeAiProvider) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const next = await startCreativeAiProviderLogin(provider);
      setLoginProvider(provider);
      setLogin(next);
      if (next.status === 'CONNECTED') {
        addToast('success', `${provider === 'CLAUDE' ? 'Claude' : 'Codex'} is already connected.`);
        await load();
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to start sign-in.');
    } finally {
      setBusyProvider(null);
    }
  }, [addToast, load]);

  const test = useCallback(async (provider: CreativeAiProvider) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const result = await testCreativeAiProvider(provider);
      addToast(result.ok ? 'success' : 'error', result.message);
      await load();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Unable to test the AI connection.');
    } finally {
      setBusyProvider(null);
    }
  }, [addToast, load]);

  const logout = useCallback(async (provider: CreativeAiProvider) => {
    setBusyProvider(provider);
    setError(null);
    try {
      const result = await logoutCreativeAiProvider(provider);
      addToast('success', result.message);
      await load();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to disconnect the AI account.');
    } finally {
      setBusyProvider(null);
    }
  }, [addToast, load]);

  const submitLoginCode = useCallback(async (code: string) => {
    if (!loginProvider || !login?.loginId) return;
    setSubmittingCode(true);
    setError(null);
    try {
      setLogin(await submitCreativeAiProviderLoginCode(loginProvider, login.loginId, code));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the authorization code.');
    } finally {
      setSubmittingCode(false);
    }
  }, [login?.loginId, loginProvider]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateCreativeAiConfig(draft);
      setConfig((current) => current ? { ...current, policy: saved } : current);
      addToast('success', 'AI defaults saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save AI defaults.');
    } finally {
      setSaving(false);
    }
  }, [addToast, draft]);

  const setDefaultProvider = useCallback((defaultProvider: CreativeAiProvider) => {
    setDraft((current) => {
      const providerStatus = config?.providers.find((entry) => entry.provider === defaultProvider);
      const configuredModel = defaultProvider === 'CLAUDE' ? current.claudeModel : current.codexModel;
      const nextModel = providerStatus?.models.find((entry) => entry.id === configuredModel) ?? providerStatus?.models[0];
      const nextEffort = nextModel?.supportedEfforts.includes(current.defaultEffort)
        ? current.defaultEffort
        : nextModel?.defaultEffort ?? current.defaultEffort;
      return {
        ...current,
        defaultProvider,
        defaultEffort: nextEffort,
        ...(nextModel ? { [defaultProvider === 'CLAUDE' ? 'claudeModel' : 'codexModel']: nextModel.id } : {}),
      };
    });
  }, [config]);
  const setModel = useCallback((provider: CreativeAiProvider, model: string) => {
    setDraft((current) => {
      const selectedModel = config?.providers.find((entry) => entry.provider === provider)?.models.find((entry) => entry.id === model);
      return {
        ...current,
        [provider === 'CLAUDE' ? 'claudeModel' : 'codexModel']: model,
        defaultEffort: selectedModel?.supportedEfforts.includes(current.defaultEffort)
          ? current.defaultEffort
          : selectedModel?.defaultEffort ?? current.defaultEffort,
      };
    });
  }, [config]);
  const setEffort = useCallback((defaultEffort: CreativeAiEffort) => {
    setDraft((current) => ({ ...current, defaultEffort }));
  }, []);

  return useMemo(() => ({
    config,
    draft,
    loading,
    saving,
    busyProvider,
    submittingCode,
    loginProvider,
    login,
    error,
    setDraft,
    setDefaultProvider,
    setModel,
    setEffort,
    startLogin,
    test,
    logout,
    submitLoginCode,
    save,
    reload: load,
    closeLogin: () => { setLogin(null); setLoginProvider(null); },
  }), [busyProvider, config, draft, error, load, loading, login, loginProvider, logout, save, saving, setDefaultProvider, setEffort, setModel, startLogin, submitLoginCode, submittingCode, test]);
}
