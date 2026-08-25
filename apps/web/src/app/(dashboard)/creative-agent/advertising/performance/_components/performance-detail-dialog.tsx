'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Link2, Link2Off, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { DriveThumbnail } from '../../../video-registry/_components/drive-thumbnail';
import { formatCount, formatCurrency, formatPercent } from '../../../overview/_utils/creative-overview-format';
import { VerdictPill } from '../_constants/performance-columns';
import type { PerformanceRow, PerformanceResponse } from '../_types/advertising-performance';

/** Deterministic playbook instruction derived from the verdict — never generated. */
function nextAction(row: PerformanceRow): string {
  const verdict = row.verdict;
  if (verdict.suppressed) return 'Improve attribution coverage before acting on per-ad verdicts.';
  if (!verdict.decided) return 'Too early to judge — let it spend to at least one ceiling before acting.';
  if (verdict.verdict === 'KILL') return 'Pause this ad in Meta and reallocate its budget; keep the creative for a retest only with a new hook.';
  if (verdict.route === 'CONFIRMATION') return 'Hand to order confirmation with the cancellation figure — the leak is after the sale, not in the ad.';
  if (verdict.route === 'FULFILLMENT') return 'Review delivery economics with fulfillment before touching budget — the ad is buying orders at an acceptable cost.';
  if (verdict.verdict === 'WATCH') return 'Trim bid or budget until CPP clears the ceiling; avoid edits that reset the learning phase.';
  return 'Duplicate at a stepped-up budget and let the original keep earning — never risk the earning ad to scale it.';
}

type CreativeOption = { id: string; code: string; title: string };

function LinkPicker({ row, isMutating, onLink, onCancel }: {
  row: PerformanceRow;
  isMutating: boolean;
  onLink: (creativeId: string) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CreativeOption[]>([]);
  const [selected, setSelectedId] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await apiClient.get('/creative-agent/library', {
          params: { query: search.trim() || undefined, page: 1, pageSize: 10 },
        });
        setOptions((data.items ?? []).map((item: CreativeOption) => ({ id: item.id, code: item.code, title: item.title })));
      } catch {
        setOptions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div className="rounded-xl border border-border/50 bg-background p-3 dark:bg-background-secondary">
      <p className="text-sm-custom font-semibold text-foreground">Link this Meta ad to a creative</p>
      <p className="mt-0.5 text-xs-tight text-muted">
        An explicit identity connection — the ad name is kept only as an audit snapshot and never has to contain a code.
      </p>
      <label className="relative mt-2 block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search creatives by code or title"
          className="input h-9 w-full rounded-lg border-border/60 py-0 pl-8 pr-3 text-xs"
        />
      </label>
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {isSearching ? <p className="px-1 py-2 text-xs text-muted">Searching…</p> : options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm-custom hover:bg-secondary/20">
            <input
              type="radio"
              name="link-creative"
              checked={selected === option.id}
              onChange={() => setSelectedId(option.id)}
              className="h-3.5 w-3.5 accent-[rgb(var(--primary))]"
            />
            <span className="font-mono text-xs font-bold text-primary">{option.code}</span>
            <span className="min-w-0 truncate text-foreground">{option.title}</span>
          </label>
        ))}
        {!isSearching && options.length === 0 ? <p className="px-1 py-2 text-xs text-muted">No creatives found.</p> : null}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" disabled={!selected} loading={isMutating} onClick={() => onLink(selected)}>
          Link ad {row.adId}
        </Button>
      </div>
    </div>
  );
}

const PERFORMANCE_ACTIONS: Record<string, Array<{ toStatus: string; label: string }>> = {
  DRAFT: [{ toStatus: 'LIVE', label: 'Set live' }],
  LIVE: [{ toStatus: 'WINNER', label: 'Mark winner' }, { toStatus: 'FATIGUED', label: 'Mark fatigued' }],
  WINNER: [{ toStatus: 'FATIGUED', label: 'Mark fatigued' }],
  FATIGUED: [{ toStatus: 'LIVE', label: 'Return live' }],
};

export function PerformanceDetailDialog({ row, permissions, creativePerformanceStatus, isMutating, onClose, onLink, onUnlink, onTransition }: {
  row: PerformanceRow;
  permissions: PerformanceResponse['permissions'] | null;
  creativePerformanceStatus: string | null;
  isMutating: boolean;
  onClose: () => void;
  onLink: (creativeId: string) => void;
  onUnlink: () => void;
  onTransition: (toStatus: string) => void;
}) {
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const metrics = row.metrics;
  const funnel: Array<[string, string]> = [
    ['Impressions', formatCount(metrics.impressions)],
    ['Hook', formatPercent(metrics.hookRate)],
    ['Hold', formatPercent(metrics.holdRate)],
    ['CTR', formatPercent(metrics.ctr)],
    ['LP rate', formatPercent(metrics.lpRate)],
    ['CVR', formatPercent(metrics.cvr)],
  ];
  const cod: Array<[string, string]> = [
    ['Orders', formatCount(metrics.orders)],
    ['Delivered', formatCount(metrics.delivered)],
    ['Cancelled', formatCount(metrics.cancelled)],
    ['RTS', formatCount(metrics.rts)],
    ['Delivery rate', formatPercent(metrics.deliveryRate)],
    ['Cancel rate', formatPercent(metrics.cancellationRate)],
  ];
  const money: Array<[string, string]> = [
    ['Spend', formatCurrency(metrics.spend)],
    ['CPP', formatCurrency(metrics.cpp)],
    ['Delivered CPP', formatCurrency(metrics.deliveredCpp)],
    ['Delivered sales', formatCurrency(metrics.deliveredSales)],
    ['Net contribution', formatCurrency(metrics.netContribution)],
    ['Ad spend ratio', formatPercent(metrics.adSpendRatio)],
  ];
  const isAdRow = row.group === 'ADS' && row.adId !== null && row.accountId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border/60 bg-surface shadow-card"
        role="dialog" aria-modal="true" aria-label="Performance details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/40 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="hidden sm:block"><DriveThumbnail mediaUrl={row.creative?.mediaUrl ?? null} title={row.creative?.title ?? row.adName ?? 'Ad'} compact /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">
                  {row.adName ?? row.campaignName ?? row.creative?.title ?? row.key}
                </h2>
                <VerdictPill row={row} />
              </div>
              <p className="mt-1 text-sm-custom text-muted">{row.verdict.reason}</p>
              <p className="mt-1 text-sm-custom font-medium text-foreground">Next: {nextAction(row)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-background-secondary hover:text-foreground" aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {[['Funnel', funnel], ['COD outcome', cod], ['Money', money]].map(([title, entries]) => (
            <div key={title as string}>
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">{title as string}</p>
              <dl className="mt-2 space-y-1.5">
                {(entries as Array<[string, string]>).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2 text-sm-custom">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="border-t border-border/40 px-5 py-4">
          <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Identity</p>
          <div className="mt-2 grid gap-1.5 text-sm-custom sm:grid-cols-2">
            {row.creative ? (
              <>
                <p className="text-muted">Creative: <span className="font-mono font-bold text-primary">{row.creative.code}</span> <span className="text-foreground">{row.creative.title}</span></p>
                <p className="text-muted">Store: <span className="text-foreground">{row.creative.storeName ?? '—'}</span> · Creator: <span className="text-foreground">{row.creative.creatorName ?? '—'}</span></p>
              </>
            ) : (
              <p className="text-muted">Not linked to a registered creative.</p>
            )}
            {row.accountId ? <p className="break-all font-mono text-xs-tight text-muted">Account {row.accountId}</p> : null}
            {row.adId ? <p className="break-all font-mono text-xs-tight text-muted">Ad {row.adId}</p> : null}
            {row.campaignId ? <p className="break-all font-mono text-xs-tight text-muted">Campaign {row.campaignId}</p> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {row.creative ? (
              <Link href={`/assets?creative=${row.creative.id}`} className="btn btn-sm btn-outline">Open in Assets</Link>
            ) : null}
            {row.creative && row.group !== 'CREATIVES' ? (
              <Link href={`/performance?group=CREATIVES&creativeId=${row.creative.id}`} className="btn btn-sm btn-ghost" onClick={onClose}>All ads for this creative</Link>
            ) : null}
            {permissions?.canManageLinks && isAdRow && !row.creative ? (
              <Button variant="primary" size="sm" iconLeft={<Link2 className="h-3.5 w-3.5" />} onClick={() => setShowLinkPicker(true)}>
                Link to creative
              </Button>
            ) : null}
            {permissions?.canManageLinks && isAdRow && row.creative ? (
              <Button variant="ghost" size="sm" iconLeft={<Link2Off className="h-3.5 w-3.5" />} loading={isMutating} onClick={onUnlink}>
                Unlink Meta ad
              </Button>
            ) : null}
          </div>

          {showLinkPicker && isAdRow ? (
            <div className="mt-3">
              <LinkPicker row={row} isMutating={isMutating} onLink={onLink} onCancel={() => setShowLinkPicker(false)} />
            </div>
          ) : null}

          {permissions?.canManagePerformance && row.creative && creativePerformanceStatus ? (
            <div className="mt-4 border-t border-border/40 pt-3">
              <p className="text-xs-tight font-semibold uppercase tracking-wide text-faint">
                Creative performance status: {creativePerformanceStatus}
              </p>
              <p className="mt-1 text-xs-tight text-muted">
                The Scale/Watch/Kill verdict above is a recommendation and is never saved as the status.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(PERFORMANCE_ACTIONS[creativePerformanceStatus] ?? []).map((action) => (
                  <Button key={action.toStatus} variant="secondary" size="sm" loading={isMutating} onClick={() => onTransition(action.toStatus)}>
                    {action.label}
                  </Button>
                ))}
                {creativePerformanceStatus !== 'RETIRED' ? (
                  <Button variant="ghost" size="sm" loading={isMutating} onClick={() => onTransition('RETIRED')}>Retire</Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
