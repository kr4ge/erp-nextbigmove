'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Inbox, LayoutGrid, List, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { EditCreativeDialog } from '../../video-registry/_components/edit-creative-dialog';
import { CreativeAiAnalysisDialog } from '../../video-registry/_components/creative-ai-analysis-dialog';
import { RegistryPagination } from '../../video-registry/_components/registry-pagination';
import { VideoRegistryDateRangePicker } from '../../video-registry/_components/video-registry-date-range-picker';
import { AnalyticsMultiSelectPicker } from '../../../analytics/_components/analytics-multi-select-picker';
import { useCreativeAssetsController } from '../_hooks/use-creative-assets-controller';
import type { CreativeAsset } from '../_types/creative-assets';
import { CreativeAssetReviewDialog } from './creative-asset-review-dialog';
import { CreativeAssetsGrid } from './creative-assets-grid';
import { CreativeAssetsTable } from './creative-assets-table';
import { UnlinkedAdsPanel } from './unlinked-ads-panel';

/**
 * Toggling one entry when "All" is on means everything except that one, so
 * an empty selection keeps meaning "all" rather than "none".
 */
function toggleIn(selected: string[], options: Array<{ value: string }>, value: string): string[] {
  const current = selected.length === 0 ? options.map((option) => option.value) : selected;
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return next.length === options.length ? [] : next;
}

const filterButtonBase = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';
const filterButtonIdle = 'border-border/60 bg-surface text-foreground hover:bg-background-secondary';
const filterButtonActive = 'border-primary/40 bg-primary-soft/40 font-medium text-primary';
const filterDropdownClass = 'absolute left-0 z-30 mt-1.5 w-64 rounded-lg border border-border bg-surface shadow-lg';

type FilterOption = { value: string; label: string };

/**
 * One filter on the toolbar. It reads as its name while it narrows nothing,
 * and as the chosen value, highlighted, once it does; so the row says at a
 * glance which filters are on. The picker beneath is the one the advertiser
 * dashboard uses.
 */
function AssetFilter({ name, title, noun, options, selected, onChange }: {
  name: string;
  title: string;
  noun: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const active = selected.length > 0;
  const label = !active
    ? name
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label ?? name
      : `${selected.length} ${noun}`;
  return (
    <AnalyticsMultiSelectPicker
      className="relative shrink-0"
      chevron
      buttonClassName={`${filterButtonBase} ${active ? filterButtonActive : filterButtonIdle}`}
      labelClassName="truncate"
      dropdownClassName={filterDropdownClass}
      selectedLabel={label}
      selectTitle={title}
      options={options}
      allChecked={!active}
      isChecked={(value) => !active || selected.includes(value)}
      onToggleAll={() => onChange([])}
      onToggle={(value) => onChange(toggleIn(selected, options, value))}
      onOnly={(value) => onChange([value])}
      onClear={() => onChange([])}
    />
  );
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function CreativeAssetsScreen({ initialQuery = '', initialCreativeId, initialRevisionState, initialQueue }: {
  initialQuery?: string;
  initialCreativeId?: string;
  initialRevisionState?: string;
  initialQueue?: string;
}) {
  const controller = useCreativeAssetsController({
    query: initialQuery,
    creativeId: initialCreativeId,
    revisionState: initialRevisionState,
    queue: initialQueue,
  });
  const { addToast } = useToast();
  const { data, params } = controller;
  const isReviewerView = Boolean(data?.permissions.canReadAll && controller.canReview);
  const storeOptions = useMemo(() => data?.filters.stores ?? [], [data?.filters.stores]);
  const creatorOptions = useMemo(() => data?.filters.creators ?? [], [data?.filters.creators]);
  const linkOptions = useMemo(() => data?.filters.linkStates ?? [], [data?.filters.linkStates]);
  const analysisOptions = useMemo(() => data?.filters.analysisStates ?? [], [data?.filters.analysisStates]);
  const hasActiveFilters = Boolean(controller.searchText.trim()) || params.storeIds.length > 0 || params.creatorIds.length > 0 || params.linked.length > 0 || params.analyzed.length > 0;
  const clearFilters = () => {
    controller.setSearchText('');
    controller.updateParams({ query: '', storeIds: [], creatorIds: [], linked: [], analyzed: [] });
  };
  const [analysisTarget, setAnalysisTarget] = useState<CreativeAsset | null>(null);
  const analysisDateRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    return { startDate: localIsoDate(start), endDate: localIsoDate(end) };
  }, []);

  const addComment = async (message: string) => {
    await controller.addComment(message);
    addToast('success', 'Feedback sent.');
  };

  const transition = async (status: string, reason?: string) => {
    await controller.transition(status, reason);
    const messages: Record<string, string> = {
      FOR_APPROVAL: 'Creative submitted for approval. Advertising acts next.',
      REVISED: 'Revision submitted. Advertising acts next.',
      FOR_POSTING: 'Creative approved for posting.',
      FOR_REVISION: 'Creative returned for revision.',
      POSTED: 'Creative marked as posted.',
      CANCELLED: 'Creative cancelled.',
    };
    addToast('success', messages[status] ?? 'Creative status updated.');
  };

  const updateCreative = async (id: string, input: Parameters<typeof controller.updateCreative>[1]) => {
    await controller.updateCreative(id, input);
    addToast('success', 'Creative changes saved. You can now submit it for approval.');
  };
  return <div>
    <PageHeader
      title={isReviewerView ? "Advertising Assets" : data?.permissions.canReadAll ? "Creative Assets" : "My Assets"}
      description={isReviewerView
        ? "The tenant-wide approval and launch queue: review submissions, approve for posting, and pick up exact codes to paste into Meta."
        : "Track your drafts, submissions, revision requests, and feedback in one focused workspace."}
      breadcrumbs={isReviewerView ? "Advertising Workspace" : "Assets"}
    />
    {isReviewerView ? <UnlinkedAdsPanel /> : null}
    <section className="panel">
      {/* One row: the search first and widest, then the filters as quiet chips
          that only light up when they narrow something, then the view toggle.
          No overflow container here: a scroll container would clip the
          dropdowns. Below the xl breakpoint the row wraps instead. */}
      <div className="flex flex-wrap items-center gap-2 rounded-t-xl border-b border-border bg-surface px-3 py-2.5 xl:flex-nowrap">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={controller.searchText}
            onChange={(event) => controller.setSearchText(event.target.value)}
            className="h-9 w-full rounded-lg border border-border/60 bg-surface pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-faint focus:border-primary"
            placeholder="Search code, title, product, creator or ad ID"
          />
        </label>
        {/* Spend and the craft rates are period figures, so the window is a filter, not decoration. */}
        <div className="shrink-0"><VideoRegistryDateRangePicker compact startDate={params.startDate} endDate={params.endDate} onChange={(range) => controller.updateParams(range)} /></div>
        {data?.filters.defaultStoreId
          ? <span className="flex h-9 shrink-0 items-center rounded-lg border border-border/60 bg-background-secondary px-3 text-sm text-muted">{data.filters.stores[0]?.label ?? 'Store'}</span>
          : <AssetFilter name="Stores" title="Stores" noun="stores" options={storeOptions} selected={params.storeIds} onChange={(storeIds) => controller.updateParams({ storeIds })} />}
        {data?.permissions.canReadAll
          ? <AssetFilter name="Creators" title="Creators" noun="creators" options={creatorOptions} selected={params.creatorIds} onChange={(creatorIds) => controller.updateParams({ creatorIds })} />
          : null}
        {/* The revision-state filter is parked for now; a deep link with ?revisionState= still narrows the list. */}
        <AssetFilter name="Meta link" title="Meta link" noun="states" options={linkOptions} selected={params.linked} onChange={(linked) => controller.updateParams({ linked: linked as typeof params.linked })} />
        <AssetFilter name="AI analysis" title="AI analysis" noun="states" options={analysisOptions} selected={params.analyzed} onChange={(analyzed) => controller.updateParams({ analyzed: analyzed as typeof params.analyzed })} />
        {hasActiveFilters
          ? <button type="button" onClick={clearFilters} className="shrink-0 px-1 text-xs font-medium text-muted transition hover:text-foreground">Clear</button>
          : null}
        <div className="ml-auto flex h-9 shrink-0 rounded-lg border border-border/60 bg-background-secondary p-0.5">
          <button type="button" onClick={() => controller.setView('tiles')} className={`flex h-8 w-8 items-center justify-center rounded-md transition ${controller.view === 'tiles' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'}`} aria-label="Tile view" aria-pressed={controller.view === 'tiles'}><LayoutGrid className="h-4 w-4" /></button>
          <button type="button" onClick={() => controller.setView('table')} className={`flex h-8 w-8 items-center justify-center rounded-md transition ${controller.view === 'table' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-foreground'}`} aria-label="Table view" aria-pressed={controller.view === 'table'}><List className="h-4 w-4" /></button>
        </div>
      </div>
      {controller.error ? <div className="m-4 rounded-xl border border-destructive/30 bg-destructive-soft p-5 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-destructive" /><p className="mt-2 font-semibold text-foreground">Assets could not load</p><p className="mt-1 text-sm text-muted">{controller.error}</p><button type="button" className="btn btn-sm btn-outline mt-3" onClick={() => void controller.retry()}>Try again</button></div> : controller.isLoading && !data ? <div className="p-16 text-center text-sm text-muted">Loading your assets…</div> : data?.items.length ? controller.view === 'tiles' ? <CreativeAssetsGrid items={data.items} onReview={(item) => void controller.openAsset(item)} /> : <CreativeAssetsTable items={data.items} onReview={(item) => void controller.openAsset(item)} /> : <div className="p-16 text-center"><Inbox className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 font-semibold text-foreground">No assets in this stage</p><p className="mt-1 text-sm text-muted">Your enrolled creatives will appear here automatically.</p></div>}
      {data ? <RegistryPagination {...data.pagination} onPageChange={(page) => controller.updateParams({ page })} /> : null}
    </section>
    <CreativeAssetReviewDialog
      asset={controller.selected}
      comments={controller.comments}
      isLoadingComments={controller.isLoadingComments}
      isSaving={controller.isMutating}
      showPerformanceLink={isReviewerView}
      canReview={controller.canReview}
      canAnalyze={controller.canUseAi}
      onClose={() => controller.setSelected(null)}
      onComment={addComment}
      onTransition={transition}
      onEdit={controller.openEdit}
      onAnalyze={(asset) => {
        controller.setSelected(null);
        setAnalysisTarget(asset);
      }}
    />
    <CreativeAiAnalysisDialog
      item={analysisTarget}
      startDate={analysisDateRange.startDate}
      endDate={analysisDateRange.endDate}
      onClose={() => setAnalysisTarget(null)}
    />
    <EditCreativeDialog
      item={controller.editing}
      isSaving={controller.isMutating}
      onClose={() => controller.setEditing(null)}
      onSave={updateCreative}
      onUploadThumbnail={controller.uploadThumbnail}
      onRemoveThumbnail={controller.removeThumbnail}
    />
  </div>;
}
