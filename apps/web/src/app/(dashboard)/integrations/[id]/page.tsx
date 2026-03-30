'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LoadingCard } from '@/components/ui/feedback';
import { IntegrationDetailHeader } from '../_components/integration-detail-header';
import { IntegrationBasicInfoSection } from '../_components/integration-basic-info-section';
import { IntegrationConfigurationSection } from '../_components/integration-configuration-section';
import { IntegrationMetadataSection } from '../_components/integration-metadata-section';
import { IntegrationDetailActions } from '../_components/integration-detail-actions';
import { IntegrationDetailAlerts } from '../_components/integration-detail-alerts';
import { useIntegrationDetailController } from '../_hooks/use-integration-detail-controller';

export default function IntegrationDetailPage() {
  const params = useParams();
  const integrationId = params.id as string;

  const {
    integration,
    isLoading,
    isSaving,
    isTesting,
    error,
    successMessage,
    name,
    setName,
    description,
    setDescription,
    apiKey,
    setApiKey,
    accessToken,
    setAccessToken,
    selectedShopId,
    setSelectedShopId,
    selectedAdAccountId,
    setSelectedAdAccountId,
    shops,
    adAccounts,
    showCredentials,
    setShowCredentials,
    handleTestConnection,
    fetchShopsOrAccounts,
    handleUpdate,
    handleToggleEnabled,
    handleDelete,
  } = useIntegrationDetailController(integrationId);

  if (isLoading) {
    return <LoadingCard label="Loading integration..." />;
  }

  if (!integration) {
    return (
      <div className="space-y-6">
        <LoadingCard
          label="Integration not found"
          className="py-10"
        />
        <Link href="/integrations" className="inline-block text-[#2563EB] hover:underline">
          Back to Integrations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationDetailHeader integration={integration} />
      <IntegrationDetailAlerts error={error} successMessage={successMessage} />

      {/* Main Form */}
      <form onSubmit={handleUpdate} className="space-y-6">
        <IntegrationBasicInfoSection
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
        />

        <IntegrationConfigurationSection
          integration={integration}
          showCredentials={showCredentials}
          apiKey={apiKey}
          accessToken={accessToken}
          selectedShopId={selectedShopId}
          selectedAdAccountId={selectedAdAccountId}
          shops={shops}
          adAccounts={adAccounts}
          onApiKeyChange={setApiKey}
          onAccessTokenChange={setAccessToken}
          onSelectedShopIdChange={setSelectedShopId}
          onSelectedAdAccountIdChange={setSelectedAdAccountId}
          onFetchOptions={fetchShopsOrAccounts}
          onShowCredentials={() => setShowCredentials(true)}
        />

        <IntegrationMetadataSection integration={integration} />

        <IntegrationDetailActions
          isSaving={isSaving}
          isTesting={isTesting}
          enabled={integration.enabled}
          onTestConnection={handleTestConnection}
          onToggleEnabled={handleToggleEnabled}
          onDelete={handleDelete}
        />
      </form>
    </div>
  );
}
