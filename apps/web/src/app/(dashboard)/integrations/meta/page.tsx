'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { MetaIntegrationsGrid } from './_components/meta-integrations-grid';
import { useMetaIntegrationsController } from './_hooks/use-meta-integrations-controller';

export default function MetaPage() {
  const router = useRouter();

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
        breadcrumbs={
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600">
            Integrations
          </span>
        }
        title="Meta Integrations"
        description="View and manage your Meta connections. Add new integrations from the main Integrations page."
      />

      {/* Error Display */}
      {error && <AlertBanner tone="error" message={error} />}

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-8 py-12 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-orange-500">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-[#0F172A]">No APIs connected</h3>
          <p className="mt-2 text-sm text-[#475569]">
            Connect your first Meta API to see it listed here.
          </p>
          <Button
            onClick={() => router.push('/integrations/create?provider=META_ADS')}
            className="mt-6"
          >
            Connect Meta API
          </Button>
        </Card>
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
