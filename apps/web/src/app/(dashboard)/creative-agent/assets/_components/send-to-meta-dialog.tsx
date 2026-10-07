'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormInput } from '@/components/ui/form-input';
import { Spinner } from '@/components/ui/spinner';
import { fetchHandoff, preflightSend, sendToMeta } from '../_services/meta-launch.service';
import type { DraftBatch, DraftCopy, PreflightInput, PreflightResult, SendCandidate } from '../_types/meta-launch';

const MAX_ADS = 3;

const money = (value: number, currency: string | null) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP', maximumFractionDigits: 0 }).format(value);

/**
 * The one screen between a creative and a paused campaign in Meta.
 *
 * Opened from a creative in Assets. The SOP allows up to three ads in the
 * campaign, so the dialog offers the other sendable creatives for the same
 * product and lets the person add up to two. Everything the SOP fixes is
 * shown, not asked; refusals come from the server, word for word, so what
 * blocks a send here is exactly what the worker would refuse on.
 */
export function SendToMetaDialog({ candidates, onClose, onSent }: {
  candidates: SendCandidate[];
  onClose: () => void;
  onSent: (batch: DraftBatch) => void;
}) {
  const anchor = candidates[0];
  const [extra, setExtra] = useState<SendCandidate[]>([]);
  const [eligible, setEligible] = useState<SendCandidate[] | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [copy, setCopy] = useState<Record<string, { primaryText: string; headline: string }>>({});
  const [plan, setPlan] = useState<PreflightResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);

  const rows = useMemo(() => [...candidates, ...extra], [candidates, extra]);

  // The other creatives this campaign could carry: same store, same product,
  // sendable, and not already sent.
  useEffect(() => {
    let cancelled = false;
    fetchHandoff({ storeId: anchor.storeConfigId, tag: '', sent: 'PENDING', query: '', page: 1, pageSize: 100 })
      .then((result) => {
        if (cancelled) return;
        setEligible(result.items
          .filter((row) => row.sendable && (row.product.customId ?? '') === (anchor.productCustomId ?? '') && !candidates.some((c) => c.id === row.id))
          .map((row) => ({ id: row.id, code: row.code, title: row.title, kind: row.kind, storeConfigId: row.store.id, productCustomId: row.product.customId, productName: row.product.name })));
      })
      .catch(() => { if (!cancelled) setEligible([]); });
    return () => { cancelled = true; };
  }, [anchor.storeConfigId, anchor.productCustomId, candidates]);

  const input = useMemo<PreflightInput>(() => ({
    storeConfigId: anchor.storeConfigId,
    creativeIds: rows.map((row) => row.id),
    campaignName: campaignName.trim() || undefined,
    dailyBudget: dailyBudget.trim() ? Number(dailyBudget) : undefined,
    startDate: startDate || undefined,
    copy: rows.map<DraftCopy>((row) => ({
      creativeId: row.id,
      primaryText: copy[row.id]?.primaryText?.trim() || undefined,
      headline: copy[row.id]?.headline?.trim() || undefined,
    })),
  }), [anchor.storeConfigId, rows, campaignName, dailyBudget, startDate, copy]);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await preflightSend(input);
      setPlan(result);
      // Seed the editable fields from the server's defaults once, so the person
      // sees what will be sent and can change it. Copy for a newly added
      // creative is seeded when it first appears.
      if (!seeded.current) {
        seeded.current = true;
        setCampaignName(result.campaignName);
        setDailyBudget(String(result.dailyBudget));
        setStartDate(result.startTime.slice(0, 10));
      }
      setCopy((current) => {
        const next = { ...current };
        for (const creative of result.creatives) {
          if (!next[creative.id]) next[creative.id] = { primaryText: creative.primaryText, headline: creative.headline ?? '' };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check this batch.');
    } finally {
      setChecking(false);
    }
  }, [input]);

  // First check on open; later checks when the person pauses.
  useEffect(() => {
    const handle = window.setTimeout(() => { void check(); }, seeded.current ? 500 : 0);
    return () => window.clearTimeout(handle);
  }, [check]);

  const send = async () => {
    if (!plan?.ok) return;
    setSending(true);
    setError(null);
    try {
      onSent(await sendToMeta(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send this batch to Meta.');
    } finally {
      setSending(false);
    }
  };

  const overSuggestion = plan ? rows.length > plan.suggestion.suggested : false;
  const addable = (eligible ?? []).filter((candidate) => !extra.some((row) => row.id === candidate.id));
  const batchBlockers = plan ? plan.blockers.filter((blocker) => !plan.creatives.some((creative) => creative.blockers.includes(blocker))) : [];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-11/12 max-w-3xl flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
          <DialogTitle>Send {rows.length} creative{rows.length === 1 ? '' : 's'} to Meta</DialogTitle>
          <DialogDescription>
            One campaign, one ad set, {rows.length} paused ad{rows.length === 1 ? '' : 's'}. Nothing goes live until someone publishes it in Ads Manager.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {plan ? (
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${overSuggestion ? 'border-warning/30 bg-warning-soft/40 text-foreground' : 'border-info/30 bg-info-soft/30 text-foreground'}`}>
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <span>
                <span className="font-medium">SOP suggests {plan.suggestion.suggested} ad{plan.suggestion.suggested === 1 ? '' : 's'}.</span> {plan.suggestion.reason}
              </span>
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <FormInput id="send-campaign-name" label="Campaign name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="sm:col-span-3" maxLength={255} />
            <FormInput id="send-daily-budget" label={`Daily budget${plan?.currency ? ` (${plan.currency})` : ''}`} type="number" min={1} step="1" value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} helper={plan?.learningBudget ? `About ${money(plan.learningBudget, plan.currency)} a day leaves learning in a week at the store's target CPP.` : undefined} />
            <FormInput id="send-start-date" label={`Start (00:00 ${plan?.timezone ?? 'Asia/Manila'})`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <div className="space-y-1.5">
              <span className="form-label">Ad set</span>
              <p className="input flex items-center truncate text-muted" title={plan?.adSetName}>{plan?.adSetName ?? '—'}</p>
            </div>
          </section>

          {plan?.profile ? (
            <dl className="grid gap-x-6 gap-y-1 rounded-lg border border-border bg-background-secondary/40 px-4 py-3 text-xs sm:grid-cols-2">
              <Row label="Ad account" value={plan.profile.adAccountId} />
              <Row label="Page" value={plan.profile.pageName ?? 'Set'} />
              <Row label="Instagram" value={plan.profile.instagramUsername ? `@${plan.profile.instagramUsername}` : 'Not linked'} />
              <Row label="Pixel" value={plan.profile.pixelId} />
              <Row label="Landing page" value={plan.profile.landingPageUrl} link />
              <Row label="Fixed by SOP" value="Sales · campaign budget · highest volume · broad PH 18+ · Advantage+ placements · paused" />
            </dl>
          ) : plan ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-sm text-foreground">
              The store&apos;s Meta publishing profile is missing: {plan.missingProfile.join(', ')}. Set it from the store page under Quick Actions.
            </p>
          ) : null}

          <section className="space-y-3">
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted">Ads</h4>
            {rows.map((row) => {
              const planned = plan?.creatives.find((creative) => creative.id === row.id);
              const removable = extra.some((candidate) => candidate.id === row.id);
              return (
                <div key={row.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-primary" title={planned?.adName}>{planned?.adName ?? row.code}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {planned ? (
                        planned.blockers.length
                          ? <span className="pill border border-destructive/30 bg-destructive-soft text-destructive">Blocked</span>
                          : <span className="pill border border-success/30 bg-success-soft/40 text-success">Ready</span>
                      ) : null}
                      {removable ? (
                        <button type="button" onClick={() => setExtra((current) => current.filter((candidate) => candidate.id !== row.id))} className="rounded-lg p-1 text-muted hover:bg-secondary/40 hover:text-foreground" aria-label={`Remove ${row.code} from this send`}>
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {planned?.blockers.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-destructive">
                      {planned.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]">
                    <textarea
                      id={`copy-primary-${row.id}`}
                      className="input min-h-16 resize-y text-sm"
                      placeholder="Primary text"
                      value={copy[row.id]?.primaryText ?? ''}
                      maxLength={2000}
                      onChange={(event) => setCopy((current) => ({ ...current, [row.id]: { primaryText: event.target.value, headline: current[row.id]?.headline ?? '' } }))}
                    />
                    <input
                      id={`copy-headline-${row.id}`}
                      className="input text-sm"
                      placeholder="Headline (optional)"
                      value={copy[row.id]?.headline ?? ''}
                      maxLength={255}
                      onChange={(event) => setCopy((current) => ({ ...current, [row.id]: { primaryText: current[row.id]?.primaryText ?? '', headline: event.target.value } }))}
                    />
                  </div>
                </div>
              );
            })}

            {rows.length < MAX_ADS && eligible !== null ? (
              addable.length ? (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs font-medium text-foreground">Add another creative for this product</p>
                  <p className="mt-0.5 text-xs text-muted">Up to {MAX_ADS} ads in one campaign. Different angles or hooks, not variations of one.</p>
                  <ul className="mt-2 space-y-1">
                    {addable.slice(0, 8).map((candidate) => (
                      <li key={candidate.id}>
                        <button type="button" onClick={() => setExtra((current) => current.length + candidates.length < MAX_ADS ? [...current, candidate] : current)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-background-secondary">
                          <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate text-foreground">{candidate.title}</span>
                          <code className="ml-auto shrink-0 text-xs font-semibold text-primary">{candidate.code}</code>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted">No other sendable creative for this product right now. Run the gate on the others, or override their verdicts, and they appear here.</p>
              )
            ) : null}
          </section>

          {plan?.warnings.length ? (
            <ul className="space-y-1.5">
              {plan.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {batchBlockers.length ? (
            <ul className="space-y-1.5">
              {batchBlockers.map((blocker) => (
                <li key={blocker} className="rounded-lg bg-destructive-soft px-3 py-2 text-xs text-destructive">{blocker}</li>
              ))}
            </ul>
          ) : null}

          {error ? <p className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="shrink-0 items-center border-t border-border px-6 py-4">
          <span className="mr-auto flex items-center gap-2 text-xs text-muted">
            {checking ? <><Spinner /> Checking…</> : plan?.ok ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Ready to send</> : plan ? 'Fix what is blocked, then send.' : null}
          </span>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={sending} disabled={!plan?.ok || checking} iconLeft={<ExternalLink className="h-4 w-4" />} onClick={() => void send()}>
            Create paused draft in Meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-foreground" title={value}>
        {link ? <a href={value} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">{value}</a> : value}
      </dd>
    </div>
  );
}
