'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CraftBoard, CraftBoardRow, OverviewFloors } from '../_types/creative-overview';
import {
  CRAFT_VERDICT_META,
  formatPercent,
  inverseRateTone,
  PILL_TONE_CLASS,
  RATE_TONE_TEXT,
  rateTone,
} from '../_utils/creative-overview-format';
import { PanelHeader } from './overview-ui';

const FOLD_LIMIT = 8;

function RateCell({ value, floor, inverse = false }: { value: number | null; floor: number | undefined; inverse?: boolean }) {
  const tone = inverse ? inverseRateTone(value, floor) : rateTone(value, floor);
  return (
    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm-custom tabular-nums">
      <span className={value == null ? 'text-muted' : RATE_TONE_TEXT[tone]}>{formatPercent(value)}</span>
    </td>
  );
}

function VerdictCell({ row }: { row: CraftBoardRow }) {
  const meta = CRAFT_VERDICT_META[row.verdict] ?? { label: row.verdict, tone: 'neutral' as const };
  return (
    <td className="px-4 py-2.5 text-right">
      <span className={PILL_TONE_CLASS[meta.tone]} title={row.reason}>{meta.label}</span>
      <p className="mt-1 hidden text-xs-tight text-muted lg:block">{row.reason}</p>
    </td>
  );
}

function NameCell({ row }: { row: CraftBoardRow }) {
  return (
    <td className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        {row.mediaUrl ? (
          <a href={row.mediaUrl} target="_blank" rel="noreferrer" className="font-mono text-xs font-bold text-primary hover:underline">
            {row.code}
          </a>
        ) : (
          <span className="font-mono text-xs font-bold text-foreground">{row.code}</span>
        )}
        {row.fatiguing ? <span className={PILL_TONE_CLASS.neutral}>fatiguing</span> : null}
      </div>
      <p className="mt-0.5 max-w-[16rem] truncate text-xs text-muted" title={row.title}>{row.title}</p>
    </td>
  );
}

function CraftTable({ rows, kind, floors }: { rows: CraftBoardRow[]; kind: 'VIDEO' | 'STATIC'; floors: OverviewFloors | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, FOLD_LIMIT);
  const isVideo = kind === 'VIDEO';
  const headers = isVideo
    ? ['Creative', 'Hook', 'Hold', 'Completion', 'CTR', 'Cancel', 'Verdict']
    : ['Creative', 'CTR', 'Cancel', 'Verdict'];
  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`w-full text-left ${isVideo ? 'min-w-[52rem]' : 'min-w-[36rem]'}`}>
          <thead className="border-b border-border/60 text-xs-tight font-semibold uppercase tracking-wide text-faint">
            <tr>
              {headers.map((header, index) => (
                <th key={header} className={`whitespace-nowrap px-4 py-2.5 ${index === 0 ? '' : 'text-right'}`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 bg-surface">
            {visible.map((row) => (
              <tr key={row.id}>
                <NameCell row={row} />
                {isVideo ? (
                  <>
                    <RateCell value={row.hookRate} floor={floors?.values.hookRate} />
                    <RateCell value={row.holdRate} floor={floors?.values.holdRate} />
                    <RateCell value={row.completionRate} floor={floors?.values.completionRate} />
                  </>
                ) : null}
                <RateCell value={row.ctr} floor={floors?.values.ctr} />
                <RateCell value={row.cancellationRate} floor={floors?.values.cancellationRate} inverse />
                <VerdictCell row={row} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > FOLD_LIMIT ? (
        <div className="border-t border-border/40 px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Show fewer' : `Show all ${rows.length}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CreativeCraftBoard({ craftBoard, floors, isLoading }: {
  craftBoard: CraftBoard | undefined;
  floors: OverviewFloors | undefined;
  isLoading: boolean;
}) {
  const videos = craftBoard?.videos ?? [];
  const statics = craftBoard?.statics ?? [];
  return (
    <section className="panel panel-content shadow-card transition-colors hover:border-border/40">
      <PanelHeader
        title="Craft board"
        description="Craft signals only — videos sorted by hook rate, statics graded on the click. Kill renders as Retire."
      />

      {isLoading && !craftBoard ? (
        <div className="p-6 text-center text-sm text-muted">Loading craft board…</div>
      ) : videos.length === 0 && statics.length === 0 ? (
        <div className="p-6 text-center">
          <p className="font-semibold text-foreground">Nothing to grade in this range</p>
          <p className="mt-1 text-sm text-muted">
            Creatives appear here once their linked ads have delivery data in the selected period.
          </p>
        </div>
      ) : (
        <>
          {videos.length > 0 ? <CraftTable rows={videos} kind="VIDEO" floors={floors} /> : null}
          {statics.length > 0 ? (
            <>
              <div className="border-t border-border/40 px-4 py-2 text-xs-tight font-semibold uppercase tracking-wide text-faint">
                Statics — graded on the click
              </div>
              <CraftTable rows={statics} kind="STATIC" floors={floors} />
            </>
          ) : null}
          <p className="border-t border-border/40 px-4 py-3 text-xs-tight leading-snug text-faint">
            Cancel rate is the one non-craft signal here: it flags an over-promising ad that would otherwise read as a winner.
            {craftBoard && craftBoard.ungradedCount > 0
              ? ` ${craftBoard.ungradedCount} creative${craftBoard.ungradedCount === 1 ? ' has' : 's have'} no delivery data in this range and ${craftBoard.ungradedCount === 1 ? 'is' : 'are'} not graded.`
              : ''}
            {floors?.provisional ? ' Floors are provisional defaults.' : ''}
          </p>
        </>
      )}
    </section>
  );
}
