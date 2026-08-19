'use client';

import { Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/feedback';
import { multiple, peso } from '../_lib/format';
import type { Position } from '../_lib/types';

export function DashboardSection({
  position,
  canEvaluate,
  verdict,
  evaluating,
  evaluateError,
  onEvaluate,
}: {
  position: Position | null;
  canEvaluate: boolean;
  verdict: string;
  evaluating: boolean;
  evaluateError: string;
  onEvaluate: () => void;
}) {
  const summary = position?.summary;
  const unattributed = summary?.adsWithNoOrders ?? 0;
  const grouped = {
    scale: position?.ads.filter((a) => a.verdict === 'SCALE').length ?? 0,
    watch: position?.ads.filter((a) => a.verdict === 'WATCH').length ?? 0,
    kill: position?.ads.filter((a) => a.verdict === 'KILL').length ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <p className="card-label">Spend</p>
                <p className="card-value">{peso(summary.spend)}</p>
                <p className="text-sm text-muted">
                  ads: <span className="font-semibold text-foreground">{summary.adsWithSpend}</span>
                </p>
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/40 ring-1 ring-border/20">
                <Wallet className="h-4 w-4 text-muted" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <p className="card-label">Net contribution</p>
                <p className="card-value">{peso(summary.netContribution)}</p>
                <p className="text-sm text-muted">after delivery, RTS and fees</p>
              </div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/40 ring-1 ring-border/20">
                <TrendingUp className="h-4 w-4 text-muted" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="min-w-0 space-y-1.5">
              <p className="card-label">Realized MER</p>
              <p className="card-value">{multiple(summary.realizedMer)}</p>
              <p className="text-sm text-muted">
                CPP: <span className="font-semibold text-foreground">{peso(summary.cpp)}</span>
              </p>
            </div>
          </div>

          <div className="card">
            <div className="min-w-0 space-y-1.5">
              <p className="card-label">POS orders</p>
              <p className="card-value">{summary.purchases}</p>
              {unattributed > 0 ? (
                <p className="text-sm text-destructive">
                  {unattributed} ad{unattributed === 1 ? '' : 's'} spending with none
                </p>
              ) : (
                <p className="text-sm text-muted">every spending ad has orders</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {position?.benchmarkIsDefault ? (
        <AlertBanner
          tone="info"
          message="Scored against the platform default benchmark — this workspace has not set its own yet."
        />
      ) : null}

      {position && position.ads.length > 0 ? (
        <section className="panel panel-content">
          <div className="panel-header flex items-center gap-2">
            <TrendingUp className="panel-icon" />
            <h4 className="panel-title">Where the period stands</h4>
          </div>
          <div className="flex flex-wrap gap-6 p-5">
            <div>
              <p className="card-label">Scale</p>
              <p className="text-lg-loose font-semibold text-foreground">{grouped.scale}</p>
            </div>
            <div>
              <p className="card-label">Watch</p>
              <p className="text-lg-loose font-semibold text-foreground">{grouped.watch}</p>
            </div>
            <div>
              <p className="card-label">Kill</p>
              <p className="text-lg-loose font-semibold text-foreground">{grouped.kill}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel panel-content">
        <div className="panel-header flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="panel-icon" />
            <h4 className="panel-title">Ask the evaluator</h4>
          </div>
          {canEvaluate ? (
            <div className="ml-auto shrink-0">
              <Button variant="primary" size="sm" onClick={onEvaluate} disabled={evaluating}>
                {evaluating ? 'Reading the period…' : 'Run evaluator'}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="p-3">
          {evaluateError ? <AlertBanner tone="error" message={evaluateError} /> : null}
          {verdict ? (
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-secondary/30 p-4 text-sm text-foreground">
              {verdict}
            </pre>
          ) : !evaluateError ? (
            <p className="text-sm text-muted">
              Every figure here is already computed. The evaluator reads this settled position and
              says what to do about it.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
