"use client";

import {
  AlertCircle,
  Library,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptystate";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import type { VideoRegistrySortKey } from "../_types/video-registry";
import { useVideoRegistryController } from "../_hooks/use-video-registry-controller";
import { LinkVideoDialog } from "./link-video-dialog";
import { RegisterVideoDialog } from "./register-video-dialog";
import { EditCreativeDialog } from "./edit-creative-dialog";
import { RegistryPagination } from "./registry-pagination";
import { UnregisteredMetaPanel } from "./unregistered-meta-panel";
import { VideoRegistryFilterBar } from "./video-registry-filter-bar";
import { VideoRegistryGrid } from "./video-registry-grid";
import { VideoRegistryTable } from "./video-registry-table";
import { VideoReviewDialog } from "./video-review-dialog";

function RegistryLoadingState() {
  return (
    <div aria-label="Loading video registry">
      <div className="animate-pulse space-y-4 p-5">
        <div className="h-5 w-48 rounded bg-background-secondary" />
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 rounded-xl bg-background-secondary" />
        ))}
      </div>
    </div>
  );
}

export function VideoRegistryScreen({ initialQuery = '' }: { initialQuery?: string }) {
  const controller = useVideoRegistryController(initialQuery);
  const { addToast } = useToast();
  const { data, params } = controller;

  const sort = (sortKey: VideoRegistrySortKey) => {
    controller.updateParams({
      sortKey,
      sortDirection:
        params.sortKey === sortKey && params.sortDirection === "desc"
          ? "asc"
          : "desc",
    });
  };

  const linkAlias = async (
    input: Parameters<typeof controller.linkAlias>[0],
  ) => {
    await controller.linkAlias(input);
    addToast(
      "success",
      `${input.alias} is now linked to the selected registry video.`,
    );
  };

  const updateCreative = async (id: string, input: Parameters<typeof controller.updateCreative>[1]) => {
    await controller.updateCreative(id, input);
    addToast("success", "Creative changes saved. You can now submit it for approval.");
  };

  const transitionStatus = async (...args: Parameters<typeof controller.transitionStatus>) => {
    await controller.transitionStatus(...args);
    const [, dimension, status] = args;
    const labels: Record<string, string> = {
      NEEDS_REVISION: "Revision requested. The creator will see your feedback in Assets.",
      RESOLVED: "Revision marked resolved.",
      LIVE: "Creative marked live.",
      WINNER: "Creative marked as a winner.",
      FATIGUED: "Creative marked as fatigued.",
      RETIRED: "Creative retired.",
    };
    addToast("success", labels[status] ?? `${dimension === "REVISION" ? "Revision" : "Performance"} status updated.`);
  };

  const registryActionLabel = controller.permissions.canReview ? "Review" : "Open";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Video Registry"
        description="Keep creative titles, Facebook post links, Meta ad-name matching, and performance signals in one library."
        breadcrumbs="Video Registry"
        actions={
          controller.permissions.canEnroll ? (
            <Button
              type="button"
              iconLeft={<Plus className="h-4 w-4" />}
              onClick={() => controller.openRegistration()}
            >
              Enroll creative
            </Button>
          ) : null
        }
      />

      {data ? (
        <UnregisteredMetaPanel
          items={data.unregistered}
          onRegister={controller.openRegistration}
          onLink={controller.setLinkingItem}
          canRegister={controller.permissions.canEnroll}
          canLink={controller.permissions.canManageAliases}
          pagination={data.unregisteredPagination}
          onPageChange={controller.updateUnregisteredPage}
        />
      ) : null}

      <section className="panel overflow-hidden">
        {data ? (
          <VideoRegistryFilterBar
            params={params}
            searchText={controller.searchText}
            filters={data.filters}
            view={controller.view}
            hasActiveFilters={controller.hasActiveFilters}
            onParamsChange={controller.updateParams}
            onSearchTextChange={controller.setSearchText}
            onViewChange={controller.setView}
            onReset={controller.resetFilters}
          />
        ) : null}

        <div className={data ? "border-t border-border" : undefined}>
          {controller.isLoading ? <RegistryLoadingState /> : null}

          {!controller.isLoading && controller.error ? (
            <div
              className="flex flex-col items-center px-6 py-16 text-center"
              role="alert"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
                <AlertCircle className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                The registry could not load
              </h2>
              <p className="mt-2 max-w-lg text-sm text-muted">
                {controller.error}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-5"
                iconLeft={<RefreshCw className="h-4 w-4" />}
                onClick={() => controller.retry()}
              >
                Try again
              </Button>
            </div>
          ) : null}

          {!controller.isLoading &&
          !controller.error &&
          data &&
          data.items.length === 0 ? (
            <EmptyState
              embedded
              title={
                controller.hasActiveFilters
                  ? "No creatives match these filters"
                  : "Your creative library is empty"
              }
              description={
                controller.hasActiveFilters
                  ? "Reset or adjust the filters to find another creative."
                  : "Enroll the first creative to mint its stable code."
              }
              actionLabel={
                controller.hasActiveFilters
                  ? "Reset filters"
                  : controller.permissions.canEnroll
                    ? "Enroll creative"
                    : undefined
              }
              onAction={
                controller.hasActiveFilters
                  ? controller.resetFilters
                  : controller.permissions.canEnroll
                    ? () => controller.openRegistration()
                    : undefined
              }
              icon={<Library className="h-12 w-12" />}
            />
          ) : null}

          {!controller.isLoading &&
          !controller.error &&
          data &&
          data.items.length > 0 ? (
            <>
              <div className="flex flex-col gap-2 border-b border-border bg-background-secondary/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-foreground">
                    {data.pagination.total}
                  </span>{" "}
                  enrolled creatives
                </p>
                <p className="text-xs text-muted">
                  Metrics shown for {params.startDate} to {params.endDate}
                </p>
              </div>
              {controller.view === "table" ? (
                <VideoRegistryTable
                  items={data.items}
                  params={params}
                  actionLabel={registryActionLabel}
                  onSort={sort}
                  onReview={(item) => void controller.openReview(item)}
                />
              ) : (
                <div className="p-4">
                  <VideoRegistryGrid
                    items={data.items}
                    actionLabel={registryActionLabel}
                    onReview={(item) => void controller.openReview(item)}
                  />
                </div>
              )}
              <RegistryPagination
                page={data.pagination.page}
                pageSize={data.pagination.pageSize}
                total={data.pagination.total}
                totalPages={data.pagination.totalPages}
                onPageChange={(page) => controller.updateParams({ page })}
              />
            </>
          ) : null}
        </div>
      </section>

      <RegisterVideoDialog
        open={controller.isRegisterOpen}
        stores={controller.stores.map((store) => ({
          value: store.id,
          label: store.name,
          nextCode: store.nextCode,
        }))}
        seed={controller.registrationSeed}
        createdItem={controller.createdItem}
        isSaving={controller.isMutating}
        onClose={controller.closeRegistration}
        onSubmit={controller.registerVideo}
      />
      <LinkVideoDialog
        item={controller.linkingItem}
        videos={data?.items ?? []}
        isSaving={controller.isMutating}
        onClose={() => controller.setLinkingItem(null)}
        onSubmit={linkAlias}
      />
      <VideoReviewDialog
        item={controller.reviewingItem}
        comments={controller.reviewComments}
        isLoadingComments={controller.isLoadingReviewComments}
        permissions={controller.permissions}
        isSaving={controller.isMutating}
        onClose={controller.closeReview}
        onEdit={controller.openEdit}
        onTransition={transitionStatus}
      />
      <EditCreativeDialog
        item={controller.editingItem}
        isSaving={controller.isMutating}
        onClose={() => controller.setEditingItem(null)}
        onSave={updateCreative}
      />
    </div>
  );
}
