'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, Boxes, ScrollText, Warehouse } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { InventoryEmptyState } from '../_components/inventory-empty-state';
import { InventoryMovementBadge } from '../_components/inventory-movement-badge';
import { fetchInventoryLedger } from '../_services/inventory.service';
import { formatDateTime, formatMoney, formatQuantity } from '../_utils/inventory-format';

export default function InventoryLedgerPage() {
  const ledgerQuery = useQuery({
    queryKey: ['wms-inventory-ledger'],
    queryFn: fetchInventoryLedger,
  });
  const ledgerError =
    ledgerQuery.error instanceof Error ? ledgerQuery.error.message : null;

  const ledger = ledgerQuery.data || [];
  const inboundCount = ledger.filter((entry) => entry.quantityDelta > 0).length;
  const outboundCount = ledger.filter((entry) => entry.quantityDelta < 0).length;
  const latestCost = ledger.find((entry) => entry.totalCost != null)?.totalCost || null;

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Ledger"
        description="Immutable stock movement history."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Entries" value={ledger.length} description="Tracked movement rows" icon={ScrollText} />
        <WmsStatCard label="Inbound" value={inboundCount} description="Positive quantity moves" icon={ArrowDownUp} accent="emerald" />
        <WmsStatCard label="Outbound" value={outboundCount} description="Negative quantity moves" icon={Boxes} accent="amber" />
        <WmsStatCard label="Latest Cost" value={formatMoney(latestCost)} description="Most recent cost-bearing move" icon={Warehouse} accent="orange" />
      </div>

      <WmsSectionCard title="Ledger Feed" metadata={`${ledger.length} rows`}>
        {ledgerQuery.isError ? (
          <InventoryEmptyState
            title="Ledger endpoint unavailable"
            description={
              ledgerError || 'Unable to load /wms/inventory/ledger. Check API runtime and migration state.'
            }
          />
        ) : ledgerQuery.isLoading ? (
          <InventoryEmptyState title="Loading ledger" description="Pulling inventory movement history." />
        ) : ledger.length === 0 ? (
          <InventoryEmptyState title="No ledger yet" description="Ledger events will appear after receipts, transfers, picks, RTS, and adjustments." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Movement</th>
                  <th className="pb-3 pr-4">SKU</th>
                  <th className="pb-3 pr-4">Warehouse</th>
                  <th className="pb-3 pr-4">Location</th>
                  <th className="pb-3 pr-4">Delta</th>
                  <th className="pb-3 pr-4">After</th>
                  <th className="pb-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-4 pr-4 text-slate-600">{formatDateTime(entry.happenedAt)}</td>
                    <td className="py-4 pr-4"><InventoryMovementBadge movementType={entry.movementType} /></td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{entry.sku}</div>
                      <div className="text-xs text-slate-500">{entry.productName}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{entry.warehouse.name}</div>
                      <div className="text-xs text-slate-500">{entry.warehouse.code}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{entry.location.name}</div>
                      <div className="text-xs text-slate-500">{entry.location.code}</div>
                    </td>
                    <td className={`py-4 pr-4 font-semibold tabular-nums ${entry.quantityDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {entry.quantityDelta >= 0 ? '+' : ''}
                      {formatQuantity(entry.quantityDelta)}
                    </td>
                    <td className="py-4 pr-4 font-semibold tabular-nums text-slate-950">{formatQuantity(entry.quantityAfter)}</td>
                    <td className="py-4">
                      <div className="font-medium text-slate-950">{entry.referenceType || 'Manual'}</div>
                      <div className="text-xs text-slate-500">{entry.referenceId || '—'}</div>
                    </td>
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
