'use client';

import { PageHeader } from '@/components/ui/page-header';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { IntegrationsSearchInput } from '../_components/integrations-search-input';
import { StoreListEmptyState } from './_components/store-list-empty-state';
import { StoreListGrid } from './_components/store-list-grid';
import { useStoreListController } from './_hooks/use-store-list-controller';

export default function StorePage() {
  const {
    isLoading,
    isFetching,
    error,
    searchInput,
    setSearchInput,
    searchTerm,
    page,
    setPage,
    pageCount,
    filteredStores,
    visibleStores,
    teamNames,
    clearSearch,
    openStore,
    goToConnectStore,
  } = useStoreListController();

  if (isLoading) {
    return <LoadingCard label="Loading stores..." />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={
            <span className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">
              Integrations
            </span>
          }
          title="POS Stores"
          description="View and manage your connected Pancake POS stores."
        />
        <AlertBanner tone="error" message={error} className="text-base" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={
          <span className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">
            Integrations
          </span>
        }
        title="POS Stores"
        description="View and manage your connected Pancake POS stores."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <IntegrationsSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search stores"
        />
      </div>

      {filteredStores.length === 0 ? (
        <StoreListEmptyState
          hasSearch={Boolean(searchTerm)}
          searchLabel={searchInput || searchTerm}
          onClearSearch={clearSearch}
          onConnectStore={goToConnectStore}
        />
      ) : (
        <StoreListGrid
          stores={visibleStores}
          teamNames={teamNames}
          isFetching={isFetching}
          page={page}
          pageCount={pageCount}
          onOpenStore={openStore}
          onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setPage((prev) => Math.min(pageCount, prev + 1))}
        />
      )}
    </div>
  );
}
