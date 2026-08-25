'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Columns, Info, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { VideoRegistryDateRangePicker } from '../../../video-registry/_components/video-registry-date-range-picker';
import { formatPercent, formatCurrency } from '../../../overview/_utils/creative-overview-format';
import { useAdvertisingPerformanceController, type PerformanceInitialFilters } from '../_hooks/use-advertising-performance-controller';
import type { PerformanceGroup, PerformanceRow, VerdictFilter } from '../_types/advertising-performance';
import { PerformanceCardList, PerformanceTable } from './performance-table';
import { PerformanceColumnPicker } from './performance-column-picker';
import { PerformanceDetailDialog } from './performance-detail-dialog';

const selectClass = 'h-9 rounded-lg border border-border/60 bg-surface px-2.5 text-xs font-medium text-foreground outline-none transition hover:border-border focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

const GROUPS: Array<{ value: PerformanceGroup; label: string }> = [
  { value: 'ADS', label: 'Ads' },
  { value: 'CAMPAIGNS', label: 'Campaigns' },
  { value: 'CREATIVES', label: 'Creatives' },
];

const VERDICTS: Array<{ value: VerdictFilter; label: string }> = [
  { value: 'NEEDS_ACTION', label: 'Needs action' },
  { value: 'SCALE', label: 'Scale' },
  { value: 'WATCH', label: 'Watch' },
  { value: 'KILL', label: 'Kill' },
  { value: 'ALL', label: 'All' },
];

export function AdvertisingPerformanceScreen({ initialFilters = {} }: { initialFilters?: PerformanceInitialFilters }) {
  const controller = useAdvertisingPerformanceController(initialFilters);
  const { data, params } = controller;
  const { addToast } = useToast();
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PerformanceRow | null>(null);
  const scope = data?.scope ?? null;

  const runAction = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      addToast('success', success);
      setSelectedRow(null);
    } catch (actionError) {
      addToast('error', actionError instanceof Error ? actionError.message : 'The action failed.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Every peso of ad spend against the POS orders it bought — with a deterministic Scale/Watch/Kill read per row."
        breadcrumbs="Advertising Workspace"
      />

      <div className="space-y-4">
        {controller.error ? (
          <div className="panel border-destructive/20 bg-destructive/5 p-5 text-center shadow-card">
            <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
            <p className="mt-2 font-semibold text-foreground">Performance could not load</p>
            <p className="mt-1 text-sm text-muted">{controller.error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void controller.retry()}>Try again</Button>
          </div>
        ) : null}

        {data?.warnings.length ? (
          <div className="grid gap-2 rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-3 dark:bg-warning/10">
            {data.warnings.map((warning) => (
              <div key={warning.code} className="flex items-start gap-2 text-sm-custom text-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        ) : null}

        <section className="panel panel-content shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-3">
            <div className="flex h-9 rounded-lg border border-border/60 bg-secondary/20 p-0.5 dark:bg-background-secondary" role="group" aria-label="Aggregation mode">
              {GROUPS.map((group) => (
                <button
                  key={group.value}
                  type="button"
                  onClick={() => controller.updateParams({ group: group.value, adId: '', campaignId: '', creativeId: '' })}
                  className={`rounded-md px-2.5 text-xs font-semibold transition ${params.group === group.value ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
                >
                  {group.label}
                </button>
              ))}
            </div>
            <label className="relative min-w-48 flex-[1_1_14rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={controller.searchText}
                onChange={(event) => controller.setSearchText(event.target.value)}
                placeholder="Search ad, code, or campaign"
                className="input h-9 w-full rounded-lg border-border/60 py-0 pl-8 pr-3 text-xs"
              />
            </label>
            <VideoRegistryDateRangePicker compact startDate={params.startDate} endDate={params.endDate} onChange={(range) => controller.updateParams(range)} />
            <select value={params.storeId} onChange={(event) => controller.updateParams({ storeId: event.target.value })} className={`${selectClass} w-32`} aria-label="Filter by store">
              <option value="">All stores</option>
              {data?.filters.stores.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {(data?.filters.accounts.length ?? 0) > 1 ? (
              <select value={params.accountId} onChange={(event) => controller.updateParams({ accountId: event.target.value })} className={`${selectClass} w-36`} aria-label="Filter by Meta account">
                <option value="">All accounts</option>
                {data?.filters.accounts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : null}
            {params.group === 'ADS' ? (
              <select value={params.linkStatus} onChange={(event) => controller.updateParams({ linkStatus: event.target.value as typeof params.linkStatus })} className={`${selectClass} w-28`} aria-label="Filter by link state">
                <option value="ALL">All links</option>
                <option value="LINKED">Linked</option>
                <option value="UNLINKED">Unlinked</option>
              </select>
            ) : null}
            <Button variant="ghost" size="sm" iconLeft={<SlidersHorizontal className="h-3.5 w-3.5" />} onClick={() => setShowSecondaryFilters((current) => !current)} aria-expanded={showSecondaryFilters}>
              Filters
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<Columns className="h-3.5 w-3.5" />} onClick={() => setShowColumnPicker(true)}>
              Columns
            </Button>
          </div>

          {showSecondaryFilters ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-border/40 bg-secondary/10 px-4 py-2.5 dark:bg-background-secondary/40">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--primary))]" checked={params.hideNoOrders} onChange={(event) => controller.updateParams({ hideNoOrders: event.target.checked })} />
                Hide rows with no orders
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--primary))]" checked={params.showInactive} onChange={(event) => controller.updateParams({ showInactive: event.target.checked })} />
                Show paused/inactive ads
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                Min spend
                <input
                  type="number" min={0} value={params.minSpend}
                  onChange={(event) => controller.updateParams({ minSpend: event.target.value })}
                  className="input h-8 w-24 rounded-lg border-border/60 py-0 text-xs"
                  placeholder="₱0"
                />
              </label>
              {params.adId || params.creativeId || params.campaignId ? (
                <Button variant="ghost" size="sm" onClick={() => controller.updateParams({ adId: '', creativeId: '', campaignId: '' })}>
                  Clear focus filter
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Verdict filter">
              {VERDICTS.map((verdict) => (
                <button
                  key={verdict.value}
                  type="button"
                  onClick={() => controller.updateParams({ verdict: verdict.value })}
                  className={`rounded-full px-2.5 py-1 text-xs-tight font-semibold uppercase tracking-wide transition ${params.verdict === verdict.value ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-secondary/30 text-muted hover:text-foreground dark:bg-background-secondary'}`}
                >
                  {verdict.label}
                </button>
              ))}
            </div>
            <p className="text-xs-tight text-faint">
              {scope?.ceiling.workingCeiling != null
                ? `Working ceiling ${formatCurrency(scope.ceiling.workingCeiling)}${scope.ceiling.provisional ? ' · provisional (break-even derived)' : ''} · attribution ${formatPercent(scope.attributionCoverage, 0)}`
                : 'No cost ceiling available for this scope yet.'}
            </p>
          </div>

          <div className="hidden md:block">
            <PerformanceTable
              columns={controller.columns}
              items={data?.items}
              scope={scope}
              isLoading={controller.isLoading}
              sortKey={params.sortKey}
              sortDirection={params.sortDirection}
              onSort={(sortKey) => controller.updateParams({
                sortKey,
                sortDirection: params.sortKey === sortKey && params.sortDirection === 'desc' ? 'asc' : 'desc',
              })}
              onSelect={setSelectedRow}
            />
          </div>
          <div className="md:hidden">
            <PerformanceCardList items={data?.items} isLoading={controller.isLoading} onSelect={setSelectedRow} />
          </div>

          {data ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-4 py-3">
              <p className="text-sm-custom text-muted">
                Showing {data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of {data.pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={params.pageSize}
                  onChange={(event) => controller.updateParams({ pageSize: Number(event.target.value) })}
                  className={`${selectClass} w-24`}
                  aria-label="Rows per page"
                >
                  {[25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
                </select>
                <button type="button" disabled={data.pagination.page <= 1} onClick={() => controller.updateParams({ page: data.pagination.page - 1 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted transition hover:border-border hover:text-foreground disabled:opacity-40" aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-foreground tabular-nums">{data.pagination.page} / {data.pagination.totalPages}</span>
                <button type="button" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => controller.updateParams({ page: data.pagination.page + 1 })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted transition hover:border-border hover:text-foreground disabled:opacity-40" aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <PerformanceColumnPicker
        open={showColumnPicker}
        onOpenChange={setShowColumnPicker}
        visibleKeys={controller.visibleColumns}
        onToggle={controller.toggleColumn}
        onReset={controller.resetColumns}
      />

      {selectedRow ? (
        <PerformanceDetailDialog
          row={selectedRow}
          permissions={data?.permissions ?? null}
          creativePerformanceStatus={selectedRow.creative?.performanceStatus ?? null}
          isMutating={controller.isMutating}
          onClose={() => setSelectedRow(null)}
          onLink={(creativeId) => {
            if (!selectedRow.accountId || !selectedRow.adId) return;
            void runAction(
              () => controller.link({ creativeId, accountId: selectedRow.accountId as string, adId: selectedRow.adId as string }),
              'Meta ad linked to the creative.',
            );
          }}
          onUnlink={() => {
            if (!selectedRow.accountId || !selectedRow.adId) return;
            void runAction(
              () => controller.unlink({ accountId: selectedRow.accountId as string, adId: selectedRow.adId as string }),
              'Meta ad unlinked.',
            );
          }}
          onTransition={(toStatus) => {
            if (!selectedRow.creative) return;
            void runAction(
              () => controller.transitionPerformance(selectedRow.creative!.id, toStatus),
              'Creative performance status updated.',
            );
          }}
        />
      ) : null}
    </div>
  );
}
