'use client';

import type { CreativeScorecard as CreativeScorecardData, OverviewFloors } from '../_types/creative-overview';
import {
  formatScore,
  RATE_TONE_TEXT,
  type RateTone,
} from '../_utils/creative-overview-format';
import { PanelHeader, StatTile } from './overview-ui';



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

export function CreativeScorecard({ scorecard, floors, isLoading, kpiTiles }: {
  scorecard: CreativeScorecardData | undefined;
  floors: OverviewFloors | undefined;
  isLoading: boolean;
  kpiTiles?: Array<{ label: string; info: string; value: string; healthy?: boolean; sub?: string }>;
}) {
  const overall = scorecard?.overall ?? null;
  const tone = overallTone(overall);
  const fillPct = overall == null ? 0 : ((overall - 1) / 9) * 100;
  const isTeam = scorecard?.scope === 'TEAM';

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

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(kpiTiles ?? []).map((tile) => (
              <StatTile
                key={tile.label}
                label={tile.label}
                info={tile.info}
                value={tile.value}
                tone={tile.healthy ? 'good' : 'neutral'}
                sub={tile.sub}
              />
            ))}
          </div>

          <p className="mt-4 text-xs-tight leading-snug text-faint">
            Hitting a floor exactly scores 7. Anything unmeasurable (a static has no hook rate) is left out rather than counted as zero.
            {floors?.provisional ? ' Floors are provisional defaults.' : ''}
          </p>
        </div>
      </section>

    </>
  );
}
