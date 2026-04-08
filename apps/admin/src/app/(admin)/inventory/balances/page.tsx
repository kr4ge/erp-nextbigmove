'use client';

import { useQuery } from '@tanstack/react-query';
import { Boxes, PackageSearch, Warehouse } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { InventoryEmptyState } from '../_components/inventory-empty-state';
import { fetchInventoryBalances } from '../_services/inventory.service';
import { formatMoney, formatQuantity } from '../_utils/inventory-format';

export default function InventoryBalancesPage() {
  const balancesQuery = useQuery({
    queryKey: ['wms-inventory-balances'],
    queryFn: fetchInventoryBalances,
  });
  const balancesError =
    balancesQuery.error instanceof Error ? balancesQuery.error.message : null;

  const balances = balancesQuery.data || [];
  const totalOnHand = balances.reduce((sum, balance) => sum + balance.onHandQuantity, 0);
  const totalAvailable = balances.reduce((sum, balance) => sum + balance.availableQuantity, 0);
  const totalValue = balances.reduce((sum, balance) => sum + (balance.inventoryValue || 0), 0);

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Balances"
        description="Current stock by warehouse and bin."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard label="Rows" value={balances.length} description="Tracked balance rows" icon={PackageSearch} />
        <WmsStatCard label="On Hand" value={formatQuantity(totalOnHand)} description="Physical stock units" icon={Boxes} accent="emerald" />
        <WmsStatCard label="Available" value={formatQuantity(totalAvailable)} description="Ready to allocate" icon={Boxes} accent="amber" />
        <WmsStatCard label="Value" value={formatMoney(totalValue)} description="Inventory carrying value" icon={Warehouse} accent="orange" />
      </div>

      <WmsSectionCard title="Balance Table" metadata={`${balances.length} rows`}>
        {balancesQuery.isError ? (
          <InventoryEmptyState
            title="Balances endpoint unavailable"
            description={
              balancesError || 'Unable to load /wms/inventory/balances. Check API runtime and migration state.'
            }
          />
        ) : balancesQuery.isLoading ? (
          <InventoryEmptyState title="Loading balances" description="Pulling current stock positions." />
        ) : balances.length === 0 ? (
          <InventoryEmptyState title="No balances yet" description="Balances will appear after stock is received and posted." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="pb-3 pr-4">SKU</th>
                  <th className="pb-3 pr-4">Product</th>
                  <th className="pb-3 pr-4">Warehouse</th>
                  <th className="pb-3 pr-4">Location</th>
                  <th className="pb-3 pr-4">On Hand</th>
                  <th className="pb-3 pr-4">Reserved</th>
                  <th className="pb-3 pr-4">Available</th>
                  <th className="pb-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr key={balance.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="py-4 pr-4 font-semibold text-slate-950">{balance.sku}</td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{balance.productName}</div>
                      <div className="text-xs text-slate-500">{balance.variationName || '—'}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{balance.warehouse.name}</div>
                      <div className="text-xs text-slate-500">{balance.warehouse.code}</div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="font-medium text-slate-950">{balance.location.name}</div>
                      <div className="text-xs text-slate-500">{balance.location.code}</div>
                    </td>
                    <td className="py-4 pr-4 font-semibold tabular-nums text-slate-950">{formatQuantity(balance.onHandQuantity)}</td>
                    <td className="py-4 pr-4 tabular-nums text-slate-600">{formatQuantity(balance.reservedQuantity)}</td>
                    <td className="py-4 pr-4 font-semibold tabular-nums text-slate-950">{formatQuantity(balance.availableQuantity)}</td>
                    <td className="py-4 font-semibold tabular-nums text-slate-950">{formatMoney(balance.inventoryValue)}</td>
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
