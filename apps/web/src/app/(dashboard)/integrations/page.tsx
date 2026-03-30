'use client';

import { PageHeader } from '@/components/ui/page-header';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { IntegrationConnectionCards } from './_components/integration-connection-cards';
import { IntegrationConnectModal } from './_components/integration-connect-modal';
import { IntegrationEditTeamModal } from './_components/integration-edit-team-modal';
import { IntegrationsListCard } from './_components/integrations-list-card';
import { useIntegrationsController } from './_hooks/use-integrations-controller';

export default function IntegrationsPage() {
  const {
    teams,
    integrationTeamId,
    setIntegrationTeamId,
    allIntegrations,
    filteredIntegrations,
    searchInput,
    setSearchInput,
    isLoading,
    error,
    isModalOpen,
    modalProvider,
    isSubmitting,
    metaAccessToken,
    setMetaAccessToken,
    posApiKey,
    setPosApiKey,
    posDescription,
    setPosDescription,
    posShops,
    posSelectedShopId,
    setPosSelectedShopId,
    editIntegrationId,
    editTeamId,
    setEditTeamId,
    sharedTeamIds,
    editSharedTeamIds,
    isEditSubmitting,
    isAdmin,
    canShareIntegrations,
    metaIntegrations,
    posIntegrations,
    connectOwnerTeamId,
    editOwnerTeamId,
    openModal,
    closeModal,
    openEditModal,
    closeEditModal,
    toggleSharedTeam,
    toggleEditSharedTeam,
    handleView,
    handleMetaSubmit,
    handlePosSubmit,
    handlePosShopSelect,
    handleEditTeamSubmit,
    handleDelete,
  } = useIntegrationsController();

  if (isLoading) {
    return <LoadingCard label="Loading integrations..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your Meta Ads and Pancake POS systems to sync data."
      />

      {error && <AlertBanner tone="error" message={error} className="text-base" />}

      <IntegrationConnectionCards
        metaCount={metaIntegrations.length}
        posCount={posIntegrations.length}
        onAddMeta={() => openModal('META_ADS')}
        onAddPos={() => openModal('PANCAKE_POS')}
      />

      <IntegrationsListCard
        allCount={allIntegrations.length}
        filteredIntegrations={filteredIntegrations}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onClearSearch={() => setSearchInput('')}
        onAddIntegration={() => openModal('PANCAKE_POS')}
        onView={handleView}
        onEdit={openEditModal}
        onDelete={(integration) => handleDelete(integration.id, integration.name)}
      />

      <IntegrationConnectModal
        isOpen={isModalOpen}
        provider={modalProvider}
        isSubmitting={isSubmitting}
        teams={teams}
        isAdmin={isAdmin}
        canShareIntegrations={canShareIntegrations}
        integrationTeamId={integrationTeamId}
        sharedTeamIds={sharedTeamIds}
        metaAccessToken={metaAccessToken}
        posApiKey={posApiKey}
        posDescription={posDescription}
        posShops={posShops}
        posSelectedShopId={posSelectedShopId}
        ownerTeamId={connectOwnerTeamId}
        onClose={closeModal}
        onTeamIdChange={setIntegrationTeamId}
        onToggleSharedTeam={toggleSharedTeam}
        onMetaAccessTokenChange={setMetaAccessToken}
        onPosApiKeyChange={setPosApiKey}
        onPosDescriptionChange={setPosDescription}
        onPosSelectedShopIdChange={setPosSelectedShopId}
        onMetaSubmit={handleMetaSubmit}
        onPosSubmit={handlePosSubmit}
        onPosShopSelect={handlePosShopSelect}
      />

      <IntegrationEditTeamModal
        isOpen={Boolean(editIntegrationId)}
        isSubmitting={isEditSubmitting}
        teams={teams}
        isAdmin={isAdmin}
        canShareIntegrations={canShareIntegrations}
        teamId={editTeamId}
        sharedTeamIds={editSharedTeamIds}
        ownerTeamId={editOwnerTeamId}
        onClose={closeEditModal}
        onSubmit={handleEditTeamSubmit}
        onTeamIdChange={setEditTeamId}
        onToggleSharedTeam={toggleEditSharedTeam}
      />
    </div>
  );
}
