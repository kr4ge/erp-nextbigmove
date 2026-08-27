'use client';

import { AlertTriangle, Inbox, LayoutGrid, List, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { EditCreativeDialog } from '../../video-registry/_components/edit-creative-dialog';
import { RegistryPagination } from '../../video-registry/_components/registry-pagination';
import { REVISION_STATE_LABELS } from '../../video-registry/_constants/video-registry.constants';
import type { CreativeRevisionState } from '../../video-registry/_types/video-registry';
import { useCreativeAssetsController } from '../_hooks/use-creative-assets-controller';
import { CreativeAssetReviewDialog } from './creative-asset-review-dialog';
import { CreativeAssetsGrid } from './creative-assets-grid';
import { CreativeAssetsTable } from './creative-assets-table';

const QUEUE_STATES: CreativeRevisionState[] = ['NEEDS_REVISION', 'RESOLVED', 'NONE'];
const selectClass = 'h-10 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

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
    {isReviewerView ? <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex h-9 rounded-lg border border-border/60 bg-background-secondary p-0.5" role="group" aria-label="Queue preset">
        <button type="button" onClick={() => controller.updateParams({ queue: 'REVIEW', revisionState: '', creativeId: '' })} className={`rounded-md px-2.5 text-xs font-semibold transition ${params.queue === 'REVIEW' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>Review queue</button>
        <button type="button" onClick={() => controller.updateParams({ queue: '', revisionState: '', creativeId: '' })} className={`rounded-md px-2.5 text-xs font-semibold transition ${params.queue !== 'REVIEW' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>All statuses</button>
      </div>
      {params.queue === 'REVIEW' ? <p className="text-xs text-muted">For Approval, Revised, and For Posting — oldest submission first.</p> : null}
      {params.creativeId ? <button type="button" className="btn btn-sm btn-ghost" onClick={() => controller.updateParams({ creativeId: '' })}>Clear focused creative</button> : null}
    </div> : null}
    <div className="mb-4 grid gap-3 sm:grid-cols-3">{QUEUE_STATES.map((status) => <button key={status} type="button" onClick={() => controller.updateParams({ revisionState: params.revisionState === status ? '' : status, queue: '', creativeId: '' })} className={`card text-left transition hover:border-primary/40 ${params.revisionState === status ? 'border-primary bg-primary-soft' : ''}`}><p className="card-label">{REVISION_STATE_LABELS[status]}</p><p className="card-value mt-1">{data?.summary[status] ?? 0}</p></button>)}</div>
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface p-3">
        <label className="relative min-w-60 flex-[1_1_20rem]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={controller.searchText} onChange={(event) => controller.setSearchText(event.target.value)} className="input h-10 w-full rounded-xl pl-9 text-sm" placeholder="Search code, title, or creator" /></label>
        {data?.filters.defaultStoreId
          ? <span className="flex h-10 items-center rounded-xl border border-border bg-background-secondary px-3 text-sm font-semibold text-muted">{data.filters.stores[0]?.label ?? 'Store'}</span>
          : <select value={params.storeId} onChange={(event) => controller.updateParams({ storeId: event.target.value })} className={`${selectClass} w-44`}><option value="">All stores</option>{data?.filters.stores.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
        {data?.permissions.canReadAll ? <select value={params.creatorId} onChange={(event) => controller.updateParams({ creatorId: event.target.value })} className={`${selectClass} w-44`}><option value="">All creatives</option>{data.filters.creators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : null}
        <select value={params.revisionState} onChange={(event) => controller.updateParams({ revisionState: event.target.value as typeof params.revisionState, queue: '', creativeId: '' })} className={`${selectClass} w-44`}><option value="">All revision states</option>{data?.filters.revisionStates.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <div className="flex h-10 rounded-xl border border-border bg-background-secondary p-1"><button type="button" onClick={() => controller.setView('tiles')} className={`flex h-8 w-9 items-center justify-center rounded-lg ${controller.view === 'tiles' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`} aria-label="Tile view"><LayoutGrid className="h-4 w-4" /></button><button type="button" onClick={() => controller.setView('table')} className={`flex h-8 w-9 items-center justify-center rounded-lg ${controller.view === 'table' ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`} aria-label="Table view"><List className="h-4 w-4" /></button></div>
      </div>
      {controller.error ? <div className="m-4 rounded-xl border border-destructive/30 bg-destructive-soft p-5 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-destructive" /><p className="mt-2 font-semibold text-foreground">Assets could not load</p><p className="mt-1 text-sm text-muted">{controller.error}</p><button type="button" className="btn btn-sm btn-outline mt-3" onClick={() => void controller.retry()}>Try again</button></div> : controller.isLoading && !data ? <div className="p-16 text-center text-sm text-muted">Loading your assets…</div> : data?.items.length ? controller.view === 'tiles' ? <CreativeAssetsGrid items={data.items} onReview={(item) => void controller.openAsset(item)} /> : <CreativeAssetsTable items={data.items} onReview={(item) => void controller.openAsset(item)} /> : <div className="p-16 text-center"><Inbox className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 font-semibold text-foreground">No assets in this stage</p><p className="mt-1 text-sm text-muted">Your enrolled creatives will appear here automatically.</p></div>}
      {data ? <RegistryPagination {...data.pagination} onPageChange={(page) => controller.updateParams({ page })} /> : null}
    </section>
    <CreativeAssetReviewDialog asset={controller.selected} comments={controller.comments} isLoadingComments={controller.isLoadingComments} isSaving={controller.isMutating} showPerformanceLink={isReviewerView} canReview={controller.canReview} onClose={() => controller.setSelected(null)} onComment={addComment} onTransition={transition} onEdit={controller.openEdit} />
    <EditCreativeDialog item={controller.editing} isSaving={controller.isMutating} onClose={() => controller.setEditing(null)} onSave={updateCreative} />
  </div>;
}
