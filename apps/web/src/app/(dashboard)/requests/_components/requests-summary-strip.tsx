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
  'card';

export function RequestsSummaryStrip({ summary }: RequestsSummaryStripProps) {
  return (
    <Card className="">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className={CARD_CLASS}>
          <p className="card-label">Requests</p>
          <p className="card-value">{summary.batches}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="card-label">Procurement</p>
          <p className="card-value">{summary.procurement}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="card-label">Self-buy</p>
          <p className="card-value">{summary.selfBuy}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="card-label">Receiving Ready</p>
          <p className="card-value">{summary.readyForReceiving}</p>
        </div>
        <div className={CARD_CLASS}>
          <p className="card-label">Review Queue</p>
          <p className="card-value">{summary.underReview}</p>
        </div>
      </div>
    </Card>
  );
}
