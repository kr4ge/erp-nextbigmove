'use client';

import type { CreativeScorecard as CreativeScorecardData, OverviewFloors, ScorecardBandKey, ScorecardKpiBand, ScorecardKpiKey } from '../_types/creative-overview';
import {
  formatCount,
  formatCurrency,
  formatPercent,
  formatScore,
  RATE_TONE_TEXT,
  type RateTone,
} from '../_utils/creative-overview-format';
import { PanelHeader, StatTile } from './overview-ui';

/** Craft bands — reported here, but no longer what the 1–10 is graded on. */
const BAND_LABELS: Record<ScorecardBandKey, { label: string; info: string }> = {
  hookRate: { label: 'Hook', info: '3-second plays ÷ video impressions across every creative in the period.' },
  holdRate: { label: 'Hold', info: 'ThruPlays ÷ 3-second plays.' },
  completionRate: { label: 'Completion', info: 'ThruPlays ÷ video impressions.' },
  ctr: { label: 'CTR', info: 'Link clicks ÷ impressions.' },
};

/**
 * The three weighted KPIs that produce the score. `format` differs because
 * daily spend is money while the other two are rates, and `goal` names which
 * direction the target runs — the ad-spend ratio is the only ceiling.
 */
const KPI_LABELS: Record<ScorecardKpiKey, {
  label: string;
  info: string;
  format: 'currency' | 'percent';
  goal: 'min' | 'max';
}> = {
  dailySpend: {
    label: 'Ad Spent',
    info: 'Spend on linked creatives per day — the period total ÷ days in range, so it is comparable whatever window you pick.',
    format: 'currency',
    goal: 'min',
  },
  adSpendRatio: {
    label: 'Ads-to-Revenue',
    info: 'Ad spend ÷ sales, net of cancelled, RTS, restocked and abandoned orders. Lower is better.',
    format: 'percent',
    goal: 'max',
  },
  creativeOutput: {
    label: 'Creative Output',
    info: 'Half volume, half quality: how much was published against target, averaged with the win rate — winners ÷ published.',
    format: 'percent',
    goal: 'min',
  },
};


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

/**
 * The bar a KPI is measured against, shown in its own sub-line rather than in a
 * paragraph underneath. Creative Output names both halves it is graded on —
 * showing only the win-rate target would hide why a good win rate can still
 * score poorly on thin volume.
 */
function targetLabel(
  kpi: ScorecardKpiBand,
  goal: 'min' | 'max',
  show: (value: number | null | undefined) => string,
  floors: OverviewFloors | undefined,
): string {
  if (kpi.key === 'creativeOutput') {
    const published = floors?.scorecard?.publishedPerPeriod;
    const suffix = floors?.scorecard?.outputProvisional ? ' (default)' : '';
    return published == null
      ? `target ${show(kpi.target)} win rate${suffix}`
      : `target ${formatCount(published)} published · ${show(kpi.target)} win rate${suffix}`;
  }
  // "/day" matters: the tile is called Ad Spent, but on a multi-day window the
  // value is the daily average, not the period total.
  if (kpi.key === 'dailySpend') return `target ${show(kpi.target)}/day`;
  return `${goal === 'max' ? 'max' : 'target'} ${show(kpi.target)}`;
}

/**
 * A tile for one of the weighted KPIs, carried under the owner's own name for
 * it. The weight sits in the label and the 0–10 in the sub-line, so the tile
 * says both what the number is and how it graded.
 */
function ScoredTile({ kpiKey, label, scorecard, floors }: {
  kpiKey: ScorecardKpiKey;
  label: string;
  scorecard: CreativeScorecardData | undefined;
  floors: OverviewFloors | undefined;
}) {
  const kpi = scorecard?.kpiBands.find((band) => band.key === kpiKey);
  const meta = KPI_LABELS[kpiKey];
  const show = (value: number | null | undefined) =>
    meta.format === 'currency' ? formatCurrency(value) : formatPercent(value);
  return (
    <StatTile
      label={kpi ? `${label} · ${Math.round((kpi.weight / 10) * 100)}%` : label}
      info={meta.info}
      value={show(kpi?.value)}
      tone={bandTone(kpi?.score ?? null)}
      sub={!kpi || kpi.score == null
        ? 'not measured'
        : `${formatScore(kpi.score)}/10 · ${targetLabel(kpi, meta.goal, show, floors)}`}
    />
  );
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
  const production = scorecard?.production;

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
            ? 'One number out of 10, weighted across the three KPIs the team is measured on.'
            : 'One number out of 10, weighted across the three KPIs you are measured on.'}
        />
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className={`stat-display ${tone === 'neutral' ? 'text-foreground' : RATE_TONE_TEXT[tone]}`}>
              {formatScore(overall)}
            </p>
            <div className="pb-1">
              <p className="text-sm-custom text-muted">out of 10</p>
              <p className="mt-0.5 text-sm-custom leading-snug text-foreground">
                {scorecard?.verdict ?? 'Not enough measured data in this range to score yet.'}
              </p>
            </div>
          </div>

          <div
            className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-secondary/40 dark:bg-background-secondary"
            role="img"
            aria-label={overall == null ? 'Score unavailable' : `Score ${overall} out of 10`}
          >
            <div className={`h-full rounded-full transition-all ${TONE_FILL[tone]}`} style={{ width: `${fillPct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs-tight text-faint" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>

          <div className="mt-5 border-t border-border/40 pt-5">
            <p className="mb-3 text-xs-tight font-semibold uppercase tracking-wide text-faint">
              Craft signals
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scorecard?.bands.map((band) => (
                <StatTile
                  key={band.key}
                  label={BAND_LABELS[band.key].label}
                  info={BAND_LABELS[band.key].info}
                  value={formatPercent(band.value)}
                  tone={bandTone(band.score)}
                  sub={band.value == null
                    ? 'not measured'
                    : band.floor == null
                      ? `scores ${formatScore(band.score)}/10`
                      : `${formatScore(band.score)}/10 · ${formatPercent(band.floor)} floor`}
                />
              ))}
            </div>
            <p className="mt-3 text-xs-tight leading-snug text-faint">
              Reported, not scored — these say how the work is landing. Anything unmeasurable (a static has no hook rate) reads as not measured.
              {floors?.provisional ? ' Craft floors are provisional defaults.' : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="panel panel-content shadow-card transition-colors hover:border-border/40">
        <PanelHeader
          title="Output & results"
          description={isTeam
            ? 'The three KPIs the team’s score is weighted across, and what was published behind them.'
            : 'The three KPIs your score is weighted across, and what you published behind them.'}
        />
        {/* Published · Win Rate · AR% · Ad Spent, in that order. The last three
            carry the KPI weight and score that grade them: Win Rate is the
            Creative Output band, AR% is Ads-to-Revenue, Ad Spent is Daily Ads
            Spend. Each figure appears exactly once. */}
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Published"
            info={production
              ? `Creatives that went live inside the period — the volume half of the Win Rate score. ${formatCount(production.winners)} met the winner rule: ${production.rule.minOrders}+ orders at an AR% of ${formatPercent(production.rule.arCeiling, 0)} or lower.`
              : 'Creatives that went live inside the period.'}
            value={formatCount(production?.published)}
            sub={production
              ? `${formatCount(production.publishedVideos)} video · ${formatCount(production.publishedStatics)} static · ${formatCount(production.winners)} won`
              : undefined}
          />
          <ScoredTile
            kpiKey="creativeOutput" label="Win Rate"
            scorecard={scorecard} floors={floors}
          />
          <ScoredTile
            kpiKey="adSpendRatio" label="AR%"
            scorecard={scorecard} floors={floors}
          />
          <ScoredTile
            kpiKey="dailySpend" label="Ad Spent"
            scorecard={scorecard} floors={floors}
          />
        </div>
        {production && production.scopedCount > 0 ? (
          <p className="border-t border-border/40 px-5 py-3 text-xs-tight leading-snug text-faint">
            {production.linkedCount} of {production.scopedCount} creatives are linked to a Meta ad.
            {production.linkedCount < production.scopedCount
              ? ' Spend, AR% and wins can only count linked work — an ad whose name does not carry the code never reaches these numbers.'
              : ''}
          </p>
        ) : null}
      </section>

    </>
  );
}
