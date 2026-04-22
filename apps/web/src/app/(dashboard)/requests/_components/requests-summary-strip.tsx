'use client';

import { Card } from '@/components/ui/card';

interface RequestsSummaryStripProps {
  summary: {
    batches: number;
    procurement: number;
    selfBuy: number;
    readyForReceiving: number;
    underReview: number;
  };
}

const CARD_CLASS =
  'rounded-xl border border-[#dce4ea] bg-[#fbfdff] px-3 py-2.5';

export function RequestsSummaryStrip({ summary }: RequestsSummaryStripProps) {
  return (
    <Card className="border-[#d9e2ec]">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className={CARD_CLASS}>
          <p className="text-xs uppercase tracking-[0.16em] text-[#7b8ba1]">Requests</p>
          <p className="mt-1 text-2xl font-semibold text-[#12344d] tabular-nums">{summary.batches}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="text-xs uppercase tracking-[0.16em] text-[#7b8ba1]">Procurement</p>
          <p className="mt-1 text-2xl font-semibold text-[#12344d] tabular-nums">{summary.procurement}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="text-xs uppercase tracking-[0.16em] text-[#7b8ba1]">Self-buy</p>
          <p className="mt-1 text-2xl font-semibold text-[#12344d] tabular-nums">{summary.selfBuy}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="text-xs uppercase tracking-[0.16em] text-[#7b8ba1]">Receiving Ready</p>
          <p className="mt-1 text-2xl font-semibold text-[#12344d] tabular-nums">{summary.readyForReceiving}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="text-xs uppercase tracking-[0.16em] text-[#7b8ba1]">Review Queue</p>
          <p className="mt-1 text-2xl font-semibold text-[#12344d] tabular-nums">{summary.underReview}</p>
        </div>
      </div>
    </Card>
  );
}
