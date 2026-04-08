'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, Boxes, ClipboardList, Wallet } from 'lucide-react';
import { WmsPageHeader } from '../_components/wms-page-header';
import { WmsSectionCard } from '../_components/wms-section-card';
import { WmsStatCard } from '../_components/wms-stat-card';
import { fetchStockReceipts } from './_services/purchasing.service';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PurchasingPage() {
  const receiptsQuery = useQuery({
    queryKey: ['wms-stock-receipts'],
    queryFn: fetchStockReceipts,
  });

  const receipts = receiptsQuery.data || [];
  const totalQuantity = receipts.reduce((sum, receipt) => sum + receipt.totalQuantity, 0);
  const totalCost = receipts.reduce((sum, receipt) => sum + receipt.totalCost, 0);
  const latestReceipt = receipts[0] || null;

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Purchasing"
        description="Receiving and inbound stock posting."
        eyebrow="WMS Module"
        actions={
          <Link
            href="/purchasing/receipts"
            className="inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
          >
            Open receiving
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Receipts" value={receipts.length} description="Posted stock receipts" icon={ClipboardList} />
        <WmsStatCard label="Units" value={totalQuantity.toLocaleString('en-US')} description="Inbound quantity posted" icon={Boxes} accent="emerald" />
        <WmsStatCard label="Value" value={formatMoney(totalCost)} description="Inbound stock cost" icon={Wallet} accent="amber" />
        <WmsStatCard label="Latest" value={latestReceipt?.receiptCode || '—'} description="Most recent receipt" icon={ArrowDownToLine} accent="orange" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <WmsSectionCard title="Receiving Queue">
          <div className="grid gap-3">
            {receipts.slice(0, 5).map((receipt) => (
              <div key={receipt.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{receipt.receiptCode}</p>
                    <p className="mt-1 text-sm text-slate-500">{receipt.warehouse.name} · {receipt.location.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950 tabular-nums">
                    {formatMoney(receipt.totalCost)}
                  </p>
                </div>
              </div>
            ))}
            {receipts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No receipt yet.
              </div>
            ) : null}
          </div>
        </WmsSectionCard>

        <WmsSectionCard title="Next Action">
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-slate-950">Post new stock</p>
              <p className="mt-1 text-sm text-slate-500">Receive quantity and COGS into a warehouse location.</p>
            </div>
            <Link
              href="/purchasing/receipts"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              Go to receiving
            </Link>
          </div>
        </WmsSectionCard>
      </div>
    </div>
  );
}
