'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { WebhookConfig, WebhookLogsFilters, WebhookLogsResponse } from '../_types/webhook';
import {
  maskApiKey,
  parseWebhookErrorMessage as parseErrorMessage,
} from '../_utils/webhook-formatters';
import { webhookService } from '../_services/webhook.service';

type LogsFilterPatch = Partial<WebhookLogsFilters>;

export function useWebhookSettingsController() {
  const { addToast } = useToast();
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingRelay, setIsUpdatingRelay] = useState(false);
  const [generatedApiKey, setGeneratedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [reconcileIntervalSecondsInput, setReconcileIntervalSecondsInput] = useState('120');
  const [reconcileModeInput, setReconcileModeInput] = useState<'incremental' | 'full_reset'>('full_reset');
  const [relayEnabled, setRelayEnabled] = useState(false);
  const [relayWebhookUrl, setRelayWebhookUrl] = useState('');
  const [relayHeaderKey, setRelayHeaderKey] = useState('x-api-key');
  const [relayApiKeyInput, setRelayApiKeyInput] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<WebhookLogsResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const logsLimit = 10;
  const [logsFilters, setLogsFilters] = useState<WebhookLogsFilters>({
    receiveStatus: '',
    processStatus: '',
    relayStatus: '',
    shopId: '',
    orderId: '',
    search: '',
    startDate: '',
    endDate: '',
  });

  const canRead = useMemo(
    () =>
      permissions.length === 0 ||
      permissions.includes('integration.webhook.read') ||
      permissions.includes('integration.webhook.update'),
    [permissions],
  );

  const canManage = useMemo(
    () => permissions.length === 0 || permissions.includes('integration.webhook.update'),
    [permissions],
  );

  const canRotate = useMemo(
    () => permissions.length === 0 || permissions.includes('integration.webhook.rotate'),
    [permissions],
  );

  const displayedApiKey = useMemo(() => {
    if (generatedApiKey) {
      return showApiKey ? generatedApiKey : maskApiKey(generatedApiKey);
    }
    if (config?.hasApiKey) {
      return `••••••••••••${config.keyLast4 || ''}`;
    }
    return 'No API key generated yet';
  }, [config?.hasApiKey, config?.keyLast4, generatedApiKey, showApiKey]);

  const syncConfigInputs = useCallback((nextConfig: Partial<WebhookConfig> | null | undefined) => {
    setReconcileIntervalSecondsInput(String(nextConfig?.reconcileIntervalSeconds ?? 120));
    setReconcileModeInput(nextConfig?.reconcileMode === 'incremental' ? 'incremental' : 'full_reset');
    setRelayEnabled(!!nextConfig?.relayEnabled);
    setRelayWebhookUrl(nextConfig?.relayWebhookUrl || '');
    setRelayHeaderKey(nextConfig?.relayHeaderKey || 'x-api-key');
    setRelayApiKeyInput(nextConfig?.relayApiKey || '');
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          const parsed = JSON.parse(cachedUser);
          if (Array.isArray(parsed?.permissions)) {
            setPermissions(parsed.permissions);
          }
        }
      }
    } catch {
      // ignore cache parsing
    }

    try {
      const perms = await webhookService.fetchPermissions();
      setPermissions(perms);
    } catch {
      // keep cached permissions
    }
  }, []);

  const fetchWebhookConfig = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await webhookService.fetchConfig();
      setConfig(data);
      syncConfigInputs(data);
    } catch (error: unknown) {
      setErrorMessage(parseErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [syncConfigInputs]);

  const fetchWebhookLogs = useCallback(async () => {
    if (!canRead) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const data = await webhookService.fetchLogs(logsFilters, logsPage, logsLimit);
      setLogs(data);
    } catch (error: unknown) {
      setLogsError(parseErrorMessage(error));
    } finally {
      setLogsLoading(false);
    }
  }, [canRead, logsFilters, logsPage]);

  useEffect(() => {
    void fetchPermissions();
    void fetchWebhookConfig();
  }, [fetchPermissions, fetchWebhookConfig]);

  useEffect(() => {
    setLogsPage(1);
  }, [logsFilters]);

  useEffect(() => {
    void fetchWebhookLogs();
  }, [fetchWebhookLogs]);

  const handleCopy = useCallback(async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      addToast('success', `${label} copied.`);
    } catch {
      addToast('error', `Failed to copy ${label.toLowerCase()}.`);
    }
  }, [addToast]);

  const handleRotate = useCallback(async () => {
    setIsRotating(true);
    try {
      const data = await webhookService.rotateKey();
      const nextConfig: WebhookConfig = {
        enabled: !!data.enabled,
        autoCancelEnabled: data.autoCancelEnabled !== false,
        reconcileEnabled: data.reconcileEnabled !== false,
        reconcileIntervalSeconds: Number(data.reconcileIntervalSeconds ?? 120),
        reconcileMode: data.reconcileMode === 'incremental' ? 'incremental' : 'full_reset',
        hasApiKey: true,
        keyLast4: data.keyLast4 || null,
        rotatedAt: data.rotatedAt || null,
        rotatedByUserId: data.rotatedByUserId || null,
        headerKey: data.headerKey || 'x-api-key',
        webhookUrl: data.webhookUrl || config?.webhookUrl || '',
        relayEnabled: !!data.relayEnabled,
        relayWebhookUrl: data.relayWebhookUrl || null,
        relayApiKey: data.relayApiKey || null,
        relayHasApiKey: !!data.relayHasApiKey,
        relayKeyLast4: data.relayKeyLast4 || null,
        relayUpdatedAt: data.relayUpdatedAt || null,
        relayUpdatedByUserId: data.relayUpdatedByUserId || null,
        relayHeaderKey: data.relayHeaderKey || 'x-api-key',
      };
      setConfig(nextConfig);
      syncConfigInputs(nextConfig);
      setGeneratedApiKey(data.apiKey || '');
      setShowApiKey(false);
      addToast('success', 'Webhook API key rotated.');
    } catch (error: unknown) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsRotating(false);
    }
  }, [addToast, config?.webhookUrl, syncConfigInputs]);

  const handleToggleEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!config) return;
    setIsUpdating(true);
    try {
      const data = await webhookService.updateWebhook({ enabled: nextEnabled });
      setConfig(data);
      syncConfigInputs(data);
      addToast('success', `Webhook ${data.enabled ? 'enabled' : 'disabled'}.`);
    } catch (error: unknown) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }, [addToast, config, syncConfigInputs]);

  const handleToggleReconcileEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!config) return;
    setIsUpdating(true);
    try {
      const data = await webhookService.updateWebhook({ reconcileEnabled: nextEnabled });
      setConfig(data);
      syncConfigInputs(data);
      addToast(
        'success',
        `Webhook reconciliation ${data.reconcileEnabled ? 'enabled' : 'disabled'}.`,
      );
    } catch (error: unknown) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }, [addToast, config, syncConfigInputs]);

  const handleToggleAutoCancelEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!config) return;
    setIsUpdating(true);
    try {
      const data = await webhookService.updateWebhook({ autoCancelEnabled: nextEnabled });
      setConfig(data);
      syncConfigInputs(data);
      addToast(
        'success',
        `Auto-cancel job ${data.autoCancelEnabled ? 'enabled' : 'disabled'}.`,
      );
    } catch (error: unknown) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }, [addToast, config, syncConfigInputs]);

  const handleSaveReconcileSettings = useCallback(async () => {
    const parsed = Number(reconcileIntervalSecondsInput);
    if (!Number.isFinite(parsed) || parsed < 10 || parsed > 3600) {
      addToast('error', 'Reconcile interval must be between 10 and 3600 seconds.');
      return;
    }

    setIsUpdating(true);
    try {
      const data = await webhookService.updateWebhook({
        reconcileIntervalSeconds: Math.floor(parsed),
        reconcileMode: reconcileModeInput,
      });
      setConfig(data);
      syncConfigInputs(data);
      addToast('success', 'Reconciliation settings updated.');
    } catch (error: unknown) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }, [addToast, reconcileIntervalSecondsInput, reconcileModeInput, syncConfigInputs]);

  const handleSaveRelay = useCallback(async () => {
    setIsUpdatingRelay(true);
    try {
      const payload: {
        enabled: boolean;
        webhookUrl: string;
        headerKey: string;
        apiKey?: string;
      } = {
        enabled: relayEnabled,
        webhookUrl: relayWebhookUrl.trim(),
        headerKey: relayHeaderKey.trim(),
      };
      if (relayApiKeyInput.trim()) {
        payload.apiKey = relayApiKeyInput.trim();
      }

      const data = await webhookService.updateRelay(payload);
      setConfig(data);
      syncConfigInputs(data);
      addToast('success', 'Relay settings updated.');
    } catch (error: unknown) {
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdatingRelay(false);
    }
  }, [addToast, relayApiKeyInput, relayEnabled, relayHeaderKey, relayWebhookUrl, syncConfigInputs]);

  const handleToggleRelayEnabled = useCallback(async (nextEnabled: boolean) => {
    setRelayEnabled(nextEnabled);
    setIsUpdatingRelay(true);
    try {
      const payload: {
        enabled: boolean;
        webhookUrl: string;
        headerKey: string;
        apiKey?: string;
      } = {
        enabled: nextEnabled,
        webhookUrl: relayWebhookUrl.trim(),
        headerKey: relayHeaderKey.trim(),
      };
      if (relayApiKeyInput.trim()) {
        payload.apiKey = relayApiKeyInput.trim();
      }

      const data = await webhookService.updateRelay(payload);
      setConfig(data);
      syncConfigInputs(data);
      addToast('success', `Relay ${data?.relayEnabled ? 'enabled' : 'disabled'}.`);
    } catch (error: unknown) {
      setRelayEnabled(!nextEnabled);
      addToast('error', parseErrorMessage(error));
    } finally {
      setIsUpdatingRelay(false);
    }
  }, [addToast, relayApiKeyInput, relayHeaderKey, relayWebhookUrl, syncConfigInputs]);

  const handleLogsFiltersChange = useCallback((next: LogsFilterPatch) => {
    setLogsFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const clearLogsFilters = useCallback(() => {
    setLogsFilters({
      receiveStatus: '',
      processStatus: '',
      relayStatus: '',
      shopId: '',
      orderId: '',
      search: '',
      startDate: '',
      endDate: '',
    });
  }, []);

  return {
    config,
    loading,
    isRotating,
    isUpdating,
    isUpdatingRelay,
    generatedApiKey,
    showApiKey,
    setShowApiKey,
    reconcileIntervalSecondsInput,
    setReconcileIntervalSecondsInput,
    reconcileModeInput,
    setReconcileModeInput,
    relayEnabled,
    setRelayEnabled,
    relayWebhookUrl,
    setRelayWebhookUrl,
    relayHeaderKey,
    setRelayHeaderKey,
    relayApiKeyInput,
    setRelayApiKeyInput,
    canRead,
    canManage,
    canRotate,
    displayedApiKey,
    errorMessage,
    logs,
    logsLoading,
    logsError,
    logsPage,
    setLogsPage,
    logsLimit,
    logsFilters,
    expandedLogId,
    setExpandedLogId,
    fetchWebhookLogs,
    handleCopy,
    handleRotate,
    handleToggleEnabled,
    handleToggleReconcileEnabled,
    handleToggleAutoCancelEnabled,
    handleSaveReconcileSettings,
    handleSaveRelay,
    handleToggleRelayEnabled,
    handleLogsFiltersChange,
    clearLogsFilters,
  };
}
