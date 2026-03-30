'use client';

import { EmptyState } from '@/components/ui/emptystate';
import { PageHeader } from '@/components/ui/page-header';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { MetaIntegrationsGrid } from './_components/meta-integrations-grid';
import { useMetaIntegrationsController } from './_hooks/use-meta-integrations-controller';

export default function MetaPage() {
  const {
    integrations,
    isLoading,
    error,
    teamNames,
    openDetail,
    handleDelete,
  } = useMetaIntegrationsController();

  if (isLoading) {
    return <LoadingCard label="Loading Meta integrations..." className="py-8" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meta Integrations"
        description="View and manage your Meta connections. Add new integrations from the main Integrations page."
      />

      {/* Error Display */}
      {error && <AlertBanner tone="error" message={error} />}

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <EmptyState
          title="No Meta integrations found"
          description="Add Meta integrations from the Integrations page to see them here."
        />
      ) : (
        <MetaIntegrationsGrid
          integrations={integrations}
          teamNames={teamNames}
          onOpenDetail={openDetail}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
