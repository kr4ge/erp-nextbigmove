'use client';

import type { CreativeScorecard as CreativeScorecardData, OverviewFloors, ScorecardBandKey } from '../_types/creative-overview';
import {
  formatCount,
  formatHours,
  formatPercent,
  formatScore,
  PILL_TONE_CLASS,
  REVISION_STATE_META,
  RATE_TONE_TEXT,
  type RateTone,
} from '../_utils/creative-overview-format';
import { PanelHeader, StatTile } from './overview-ui';

const BAND_LABELS: Record<ScorecardBandKey, { label: string; info: string }> = {
  hookRate: { label: 'Hook', info: '3-second plays ÷ video impressions across every creative in the period.' },
  holdRate: { label: 'Hold', info: 'ThruPlays ÷ 3-second plays.' },
  completionRate: { label: 'Completion', info: 'ThruPlays ÷ video impressions.' },
  ctr: { label: 'CTR', info: 'Link clicks ÷ impressions.' },
  approvalRate: { label: 'Resolution rate', info: 'Revision requests resolved ÷ total requests raised.' },
};

const REVISION_ORDER = ['NEEDS_REVISION', 'RESOLVED', 'NONE'];

/**
 * Band tone: at or above the floor scores 7 and reads healthy; anything under
 * it reads amber. This panel is a scoreboard, not an alarm — nothing here goes
 * red, so a weak hook never shouts louder than the score it already lowered.
 */
function bandTone(score: number | null): RateTone {
  if (score == null) return 'neutral';
  return score >= 7 ? 'good' : 'warn';
}

/** Overall verdict tone: ≥7.5 healthy · ≥4 amber · below that, critical. Display only. */
function overallTone(overall: number | null): RateTone {
  if (overall == null) return 'neutral';
  if (overall >= 7.5) return 'good';
  if (overall >= 4) return 'warn';
  return 'bad';
}

const TONE_FILL: Record<RateTone, string> = {
  good: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-destructive',
  neutral: 'bg-primary',
};

export function CreativeScorecard({ scorecard, floors, isLoading }: {
  scorecard: CreativeScorecardData | undefined;
  floors: OverviewFloors | undefined;
  isLoading: boolean;
}) {
  const overall = scorecard?.overall ?? null;
  const tone = overallTone(overall);
  const fillPct = overall == null ? 0 : ((overall - 1) / 9) * 100;
  const isTeam = scorecard?.scope === 'TEAM';
  const census = (scorecard?.revisionCensus ?? [])
    .filter((entry) => entry.count > 0)
    .sort((a, b) => REVISION_ORDER.indexOf(a.status) - REVISION_ORDER.indexOf(b.status));

  if (isLoading && !scorecard) {
    return (
      <section className="panel shadow-card">
        <div className="p-6 text-center text-sm text-muted">Loading scorecard…</div>
      </section>
    );
  }

  return (
    <>
      <section className="panel panel-content shadow-card transition-colors hover:border-border/40">
        <PanelHeader
          title={isTeam ? 'Team score' : 'Your score'}
          description={isTeam
            ? 'One number for how the team’s work is landing — craft against the floors, plus how much was shipped.'
            : 'One number for how your work is landing — craft against the floors, plus how much you shipped.'}
        />
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className={`stat-display ${tone === 'neutral' ? 'text-foreground' : RATE_TONE_TEXT[tone]}`}>
              {formatScore(overall)}
            </p>
            <div className="pb-1">
              <p className="text-sm-custom text-muted">out of 10</p>
              <p className="mt-0.5 text-sm-custom leading-snug text-foreground">
                {scorecard?.verdict ?? 'Not enough measured data in this range to score craft yet.'}
              </p>
            </div>
          </div>

          <div
            className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-secondary/40 dark:bg-background-secondary"
            role="img"
            aria-label={overall == null ? 'Craft score unavailable' : `Craft score ${overall} out of 10`}
          >
            <div className={`h-full rounded-full transition-all ${TONE_FILL[tone]}`} style={{ width: `${fillPct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs-tight text-faint" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>

          <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {scorecard?.bands.map((band) => (
              <StatTile
                key={band.key}
                label={BAND_LABELS[band.key].label}
                info={BAND_LABELS[band.key].info}
                value={formatScore(band.score)}
                tone={bandTone(band.score)}
                sub={band.value == null
                  ? 'not measured'
                  : band.floor == null
                    ? formatPercent(band.value)
                    : `${formatPercent(band.value)} vs ${formatPercent(band.floor)} floor`}
              />
            ))}
          </div>

          <p className="mt-4 text-xs-tight leading-snug text-faint">
            Hitting a floor exactly scores 7. Anything unmeasurable (a static has no hook rate) is left out rather than counted as zero.
            {floors?.provisional ? ' Floors are provisional defaults.' : ''}
          </p>
        </div>
      </section>

      <section className="panel panel-content shadow-card transition-colors hover:border-border/40">
        <PanelHeader
          title="Efficiency contribution"
          description={isTeam
            ? 'How much work the team registered, and how quickly revision requests were resolved.'
            : 'How much work you registered, and how quickly revision requests were resolved.'}
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Resolved"
            info="Revision requests resolved in the period."
            value={formatCount(scorecard?.efficiency.approvedCount)}
            sub={`${formatCount(scorecard?.efficiency.outputCount)} registered in period`}
          />
          <StatTile
            label="Turnaround (median)"
            info="Median hours from revision request to resolution."
            value={formatHours(scorecard?.efficiency.medianTurnaroundHours)}
            sub="requested → resolved"
          />
          <StatTile
            label="Per day"
            info="Resolved requests ÷ days in the selected period."
            value={formatScore(scorecard?.efficiency.approvedPerDay, 2)}
            sub={scorecard?.efficiency.quotaConfigured
              ? `${formatPercent(scorecard.efficiency.quotaAttainment, 0)} of quota`
              : 'no quota set'}
          />
          <StatTile
            label="Resolution rate"
            info="Requests resolved ÷ requests raised."
            value={formatPercent(scorecard?.bands.find((band) => band.key === 'approvalRate')?.value, 0)}
            sub={`${formatCount(scorecard?.efficiency.cancelledCount)} still open`}
          />
        </div>
        {census.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-5 py-3">
            <span className="text-xs-tight font-semibold uppercase tracking-wide text-faint">Revision status</span>
            {census.map((entry) => {
              const meta = REVISION_STATE_META[entry.status] ?? { label: entry.status, tone: 'neutral' as const };
              return (
                <span key={entry.status} className={PILL_TONE_CLASS[meta.tone]}>
                  {meta.label} · {entry.count}
                </span>
              );
            })}
          </div>
        ) : null}
      </section>
    </>
  );
}
