'use client';

import { useParams } from 'next/navigation';
import { MetaDetailHeader } from './_components/meta-detail-header';
import { MetaIntegrationDetailsCard } from './_components/meta-integration-details-card';
import { MetaMultiplierModal } from './_components/meta-multiplier-modal';
import { MetaAccountsSection } from './_components/meta-accounts-section';
import { MetaInsightsSection } from './_components/meta-insights-section';
import { useMetaDetailController } from './_hooks/use-meta-detail-controller';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';

export default function MetaDetailPage() {
  const params = useParams();
  const integrationId = params.id as string;
  const toOptionalString = (value: string | number | boolean | null | undefined) =>
    value == null ? undefined : String(value);

  const {
    integration,
    adAccounts,
    isLoading,
    error,
    isSyncing,
    activeTab,
    setActiveTab,
    page,
    setPage,
    pageSize,
    insights,
    insightsLoading,
    insightsError,
    insightsPage,
    setInsightsPage,
    insightsPageSize,
    insightsDateRange,
    setInsightsDateRange,
    insightsAccount,
    setInsightsAccount,
    selectedAccounts,
    setSelectedAccounts,
    showMultiplierModal,
    setShowMultiplierModal,
    multiplierInput,
    setMultiplierInput,
    handleSync,
    handleTestConnection,
    handleUpdateMultiplier,
    paginatedInsights,
    totalInsights,
    insightsCanPrev,
    insightsCanNext,
    paginatedAccounts,
    totalPages,
    canPrev,
    canNext,
    eligibleAccounts,
    allEligibleSelected,
    formatDate,
    getAccountStatusText,
    getAccountStatusColor,
    getStatusBadgeClasses,
    onBack,
  } = useMetaDetailController(integrationId);

  if (isLoading) {
    return <LoadingCard label="Loading integration..." />;
  }

  if (error || !integration) {
    return <AlertBanner tone="error" message={error || 'Integration not found'} />;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <MetaDetailHeader
        name={integration.name}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        onBack={onBack}
        onTestConnection={handleTestConnection}
        onSyncAccounts={handleSync}
        isSyncing={isSyncing}
      />

      {activeTab === 'accounts' && (
        <div className="flex flex-1 flex-col gap-4 min-h-0">
          <MetaIntegrationDetailsCard
            status={integration.status}
            userId={toOptionalString(integration.config?.userId)}
            userName={toOptionalString(integration.config?.userName)}
            createdAt={integration.createdAt}
            updatedAt={integration.updatedAt}
            formatDate={formatDate}
            getStatusBadgeClasses={getStatusBadgeClasses}
          />
          <MetaAccountsSection
            adAccounts={adAccounts}
            paginatedAccounts={paginatedAccounts}
            page={page}
            pageSize={pageSize}
            canPrev={canPrev}
            canNext={canNext}
            selectedAccounts={selectedAccounts}
            allEligibleSelected={allEligibleSelected}
            onToggleSelectAll={(checked) => {
              if (checked) {
                setSelectedAccounts(eligibleAccounts.map((acc) => acc.accountId));
              } else {
                setSelectedAccounts([]);
              }
            }}
            onToggleAccount={(accountId, checked) => {
              setSelectedAccounts((prev) => {
                const set = new Set(prev);
                if (checked) set.add(accountId);
                else set.delete(accountId);
                return Array.from(set);
              });
            }}
            onOpenMultiplierModal={() => setShowMultiplierModal(true)}
            onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
            getAccountStatusText={getAccountStatusText}
            getAccountStatusColor={getAccountStatusColor}
            formatDate={formatDate}
          />
        </div>
      )}

      {activeTab === 'insights' && (
        <MetaInsightsSection
          adAccounts={adAccounts}
          insightsAccount={insightsAccount}
          insightsDateRange={insightsDateRange}
          insightsLoading={insightsLoading}
          insightsError={insightsError}
          insights={insights}
          paginatedInsights={paginatedInsights}
          insightsPage={insightsPage}
          insightsPageSize={insightsPageSize}
          totalInsights={totalInsights}
          insightsCanPrev={insightsCanPrev}
          insightsCanNext={insightsCanNext}
          onInsightsAccountChange={setInsightsAccount}
          onInsightsDateRangeChange={setInsightsDateRange}
          onPrevPage={() => setInsightsPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setInsightsPage((p) => (insightsCanNext ? p + 1 : p))}
        />
      )}

      <MetaMultiplierModal
        isOpen={showMultiplierModal}
        value={multiplierInput}
        onValueChange={setMultiplierInput}
        onClose={() => {
          setShowMultiplierModal(false);
          setMultiplierInput('');
        }}
        onSave={handleUpdateMultiplier}
      />
    </div>
  );
}
