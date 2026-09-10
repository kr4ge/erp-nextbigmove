"use client";

import { AlertCircle, Inbox, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptystate";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useVideoRegistryController } from "../_hooks/use-video-registry-controller";
import { LinkVideoDialog } from "./link-video-dialog";
import { RegisterVideoDialog } from "./register-video-dialog";
import { UnregisteredMetaPanel } from "./unregistered-meta-panel";
import { VideoRegistryDateRangePicker } from "./video-registry-date-range-picker";

function RegistryLoadingState() {
  return (
    <div aria-label="Loading detected Meta ads">
      <div className="animate-pulse space-y-4 p-5">
        <div className="h-5 w-48 rounded bg-background-secondary" />
        {[1, 2, 3].map((row) => (
          <div key={row} className="h-16 rounded-xl bg-background-secondary" />
        ))}
      </div>
    </div>
  );
}

/**
 * The enrolment desk, not the library.
 *
 * Everything already enrolled lives in Assets, with its cover art and its
 * numbers. What is left here is the queue: Meta ads that arrived through an
 * import or the API integration, are spending money, and still have no
 * registry code against them.
 */
export function VideoRegistryScreen() {
  const controller = useVideoRegistryController();
  const { addToast } = useToast();
  const { data, params } = controller;

  const linkAlias = async (
    input: Parameters<typeof controller.linkAlias>[0],
  ) => {
    await controller.linkAlias(input);
    addToast(
      "success",
      `${input.alias} is now linked to the selected registry video.`,
    );
  };

  const detected = data?.unregisteredPagination.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Video Registry"
        description="Meta ads that are spending but carry no registry code yet. Enroll one to mint its code, or link it to a creative that already exists."
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

      {/* The window decides which ads count as detected, so it is a real filter
          here rather than a display preference. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <VideoRegistryDateRangePicker
          startDate={params.startDate}
          endDate={params.endDate}
          onChange={(range) => controller.updateParams(range)}
        />
        {data && detected > 0 ? (
          <p className="text-xs text-muted">
            Spend shown for {params.startDate} to {params.endDate}
          </p>
        ) : null}
      </div>

      {controller.isLoading ? (
        <section className="panel overflow-hidden">
          <RegistryLoadingState />
        </section>
      ) : null}

      {!controller.isLoading && controller.error ? (
        <section className="panel overflow-hidden">
          <div className="flex flex-col items-center px-6 py-16 text-center" role="alert">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive-soft text-destructive">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              The registry could not load
            </h2>
            <p className="mt-2 max-w-lg text-sm text-muted">{controller.error}</p>
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
        </section>
      ) : null}

      {!controller.isLoading && !controller.error && data && detected === 0 ? (
        <section className="panel overflow-hidden">
          <EmptyState
            embedded
            title="Nothing waiting to be enrolled"
            description="Every Meta ad with spend in this period already carries a registry code. Widen the date range if you are looking for older ads."
            icon={<Inbox className="h-12 w-12" />}
          />
        </section>
      ) : null}

      {!controller.isLoading && !controller.error && data && detected > 0 ? (
        <UnregisteredMetaPanel
          items={data.unregistered}
          onRegister={controller.openRegistration}
          onLink={controller.setLinkingItem}
          canRegister={controller.permissions.canEnroll}
          canLink={controller.permissions.canManageAliases || controller.permissions.canEnroll}
          pagination={data.unregisteredPagination}
          onPageChange={controller.updateUnregisteredPage}
        />
      ) : null}

      <RegisterVideoDialog
        open={controller.isRegisterOpen}
        stores={controller.stores.map((store) => ({
          value: store.id,
          label: store.name,
          nextCode: store.nextCode,
          nextCodes: store.nextCodes,
        }))}
        seed={controller.registrationSeed}
        isSaving={controller.isMutating}
        onClose={controller.closeRegistration}
        onSubmit={controller.registerVideo}
        creatorLabel={controller.data?.viewer?.adNameCreator ?? null}
        onRegistered={(count) => {
          addToast("success", count === 1 ? "Creative registered." : `${count} creatives registered.`);
          void controller.retry({ silent: true });
        }}
      />
      <LinkVideoDialog
        item={controller.linkingItem}
        videos={data?.items ?? []}
        isSaving={controller.isMutating}
        onClose={() => controller.setLinkingItem(null)}
        onSubmit={linkAlias}
      />
    </div>
  );
}
