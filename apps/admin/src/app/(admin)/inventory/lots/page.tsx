'use client';

import { useQuery } from '@tanstack/react-query';
import { BookCopy, Boxes, Layers3, Wallet } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { InventoryEmptyState } from '../_components/inventory-empty-state';
import { InventoryLotStatusBadge } from '../_components/inventory-lot-status-badge';
import { fetchInventoryLots } from '../_services/inventory.service';
import { formatMoney, formatQuantity, formatShortDate } from '../_utils/inventory-format';

export default function InventoryLotsPage() {
  const lotsQuery = useQuery({
    queryKey: ['wms-inventory-lots'],
    queryFn: fetchInventoryLots,
  });
  const lotsError = lotsQuery.error instanceof Error ? lotsQuery.error.message : null;

  const lots = lotsQuery.data || [];
  const totalRemaining = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
  const totalLotValue = lots.reduce((sum, lot) => sum + lot.remainingQuantity * lot.unitCost, 0);
  const activeLots = lots.filter((lot) => lot.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Lots & COGS"
        description="Inbound batches and cost layers."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Lots" value={lots.length} description="Tracked inbound lots" icon={BookCopy} />
        <WmsStatCard label="Active" value={activeLots} description="Usable lots" icon={Layers3} accent="emerald" />
        <WmsStatCard label="Remaining" value={formatQuantity(totalRemaining)} description="Unconsumed units" icon={Boxes} accent="amber" />
        <WmsStatCard label="Lot Value" value={formatMoney(totalLotValue)} description="Remaining lot cost" icon={Wallet} accent="orange" />
      </div>

      <WmsSectionCard title="Lot Table" metadata={`${lots.length} rows`}>
        {lotsQuery.isError ? (
          <InventoryEmptyState
            title="Lots endpoint unavailable"
            description={
              lotsError || 'Unable to load /wms/inventory/lots. Check API runtime and migration state.'
            }
          />
        ) : lotsQuery.isLoading ? (
          <InventoryEmptyState title="Loading lots" description="Pulling inbound batches and cost layers." />
        ) : lots.length === 0 ? (
          <InventoryEmptyState title="No lots yet" description="Lots will appear once receiving starts posting stock into inventory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 pr-4">Lot</th>
                  <th className="pb-3 pr-4">SKU</th>
                  <th className="pb-3 pr-4">Warehouse</th>
                  <th className="pb-3 pr-4">Initial</th>
                  <th className="pb-3 pr-4">Remaining</th>
                  <th className="pb-3 pr-4">Unit COGS</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-950">{lot.lotCode}</div>
                      <div className="text-xs text-slate-500">{lot.supplierBatchNo || 'Internal lot'}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{lot.sku}</div>
                      <div className="text-xs text-slate-500">{lot.productName}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{lot.warehouse.name}</div>
                      <div className="text-xs text-slate-500">
                        {lot.receivedLocation?.code || lot.warehouse.code}
                      </div>
                    </td>
                    <td className="py-4 pr-4 tabular-nums text-slate-600">{formatQuantity(lot.initialQuantity)}</td>
                    <td className="py-4 pr-4 font-semibold tabular-nums text-slate-950">{formatQuantity(lot.remainingQuantity)}</td>
                    <td className="py-4 pr-4 font-semibold tabular-nums text-slate-950">{formatMoney(lot.unitCost, lot.currency)}</td>
                    <td className="py-4 pr-4"><InventoryLotStatusBadge status={lot.status} /></td>
                    <td className="py-4 text-slate-600">{formatShortDate(lot.receivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WmsSectionCard>
    </div>
  );
}
