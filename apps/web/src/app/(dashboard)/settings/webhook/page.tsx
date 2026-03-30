'use client';

import { WebhookLogsSection } from './_components/webhook-logs-section';
import { WebhookReceiveSection } from './_components/webhook-receive-section';
import { WebhookReconcileSection } from './_components/webhook-reconcile-section';
import { WebhookRelaySection } from './_components/webhook-relay-section';
import { useWebhookSettingsController } from './_hooks/use-webhook-settings-controller';
import { AlertBanner } from '@/components/ui/feedback';

export default function WebhookSettingsPage() {
  const {
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
  } = useWebhookSettingsController();

  return (
    <div className="space-y-6">
      {!canRead && (
        <AlertBanner tone="warning" message="You do not have permission to view webhook settings." />
      )}

      {errorMessage && (
        <AlertBanner tone="error" message={errorMessage} />
      )}

      <WebhookReceiveSection
        config={config}
        loading={loading}
        canManage={canManage}
        canRotate={canRotate}
        isUpdating={isUpdating}
        isRotating={isRotating}
        displayedApiKey={displayedApiKey}
        generatedApiKey={generatedApiKey}
        showApiKey={showApiKey}
        onToggleShowApiKey={() => setShowApiKey((prev) => !prev)}
        onCopy={handleCopy}
        onRotate={handleRotate}
        onToggleEnabled={handleToggleEnabled}
      />

      <WebhookReconcileSection
        config={config}
        canManage={canManage}
        loading={loading}
        isUpdating={isUpdating}
        reconcileModeInput={reconcileModeInput}
        reconcileIntervalSecondsInput={reconcileIntervalSecondsInput}
        onToggleReconcileEnabled={handleToggleReconcileEnabled}
        onReconcileModeChange={setReconcileModeInput}
        onReconcileIntervalSecondsChange={setReconcileIntervalSecondsInput}
        onSaveReconcileSettings={handleSaveReconcileSettings}
        onToggleAutoCancelEnabled={handleToggleAutoCancelEnabled}
      />

      <WebhookRelaySection
        config={config}
        loading={loading}
        canManage={canManage}
        isUpdatingRelay={isUpdatingRelay}
        relayEnabled={relayEnabled}
        relayWebhookUrl={relayWebhookUrl}
        relayHeaderKey={relayHeaderKey}
        relayApiKeyInput={relayApiKeyInput}
        onSaveRelay={handleSaveRelay}
        onToggleRelayEnabled={handleToggleRelayEnabled}
        onRelayWebhookUrlChange={setRelayWebhookUrl}
        onRelayHeaderKeyChange={setRelayHeaderKey}
        onRelayApiKeyInputChange={setRelayApiKeyInput}
      />

      <WebhookLogsSection
        canRead={canRead}
        isLoading={logsLoading}
        error={logsError}
        items={logs?.items || []}
        expandedLogId={expandedLogId}
        onToggleExpanded={(id) => setExpandedLogId((prev) => (prev === id ? null : id))}
        onRefresh={fetchWebhookLogs}
        filters={logsFilters}
        onFiltersChange={handleLogsFiltersChange}
        onClearFilters={clearLogsFilters}
        page={logsPage}
        total={logs?.pagination?.total || 0}
        totalPages={logs?.pagination?.totalPages || 1}
        limit={logsLimit}
        onPrevPage={() => setLogsPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() =>
          setLogsPage((prev) => Math.min(logs?.pagination?.totalPages || 1, prev + 1))
        }
      />
    </div>
  );
}
