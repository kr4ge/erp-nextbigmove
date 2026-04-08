'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, ClipboardList, Scale, Warehouse } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { useAdminSession } from '../../_hooks/use-admin-session';
import { hasAdminPermission } from '../../_utils/access';
import { fetchWarehouses } from '../../warehouses/_services/warehouses.service';
import {
  InventoryAdjustmentForm,
  createEmptyInventoryAdjustmentForm,
} from '../_components/inventory-adjustment-form';
import { InventoryAdjustmentStatusBadge } from '../_components/inventory-adjustment-status-badge';
import { InventoryAdjustmentTypeBadge } from '../_components/inventory-adjustment-type-badge';
import {
  createInventoryAdjustment,
  fetchInventoryAdjustments,
  fetchInventoryPosProducts,
} from '../_services/inventory.service';
import type { CreateWmsInventoryAdjustmentInput } from '../_types/inventory';
import { formatDateTime, formatMoney, formatQuantity } from '../_utils/inventory-format';

export default function InventoryAdjustmentsPage() {
  const queryClient = useQueryClient();
  const { user, permissions } = useAdminSession();
  const [form, setForm] = useState<CreateWmsInventoryAdjustmentInput>(
    createEmptyInventoryAdjustmentForm(),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ['wms-warehouses'],
    queryFn: fetchWarehouses,
  });
  const adjustmentsQuery = useQuery({
    queryKey: ['wms-inventory-adjustments'],
    queryFn: fetchInventoryAdjustments,
  });
  const profiledProductsQuery = useQuery({
    queryKey: ['wms-profiled-products'],
    queryFn: () => fetchInventoryPosProducts({ profiledOnly: true, limit: 300 }),
  });

  useEffect(() => {
    if (form.warehouseId || !warehousesQuery.data?.length) {
      return;
    }

    const warehouse = warehousesQuery.data[0];
    const location = warehouse.locations.find((item) => item.status === 'ACTIVE') || null;

    setForm((current) => ({
      ...current,
      warehouseId: warehouse.id,
      locationId: location?.id || '',
    }));
  }, [form.warehouseId, warehousesQuery.data]);

  const canCreateAdjustment =
    hasAdminPermission(user?.role, permissions, 'wms.inventory.create') ||
    hasAdminPermission(user?.role, permissions, 'wms.inventory.update');

  const createAdjustmentMutation = useMutation({
    mutationFn: () => createInventoryAdjustment(form),
    onSuccess: async (adjustment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-lots'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-ledger'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-adjustments'] }),
      ]);

      const nextWarehouse =
        warehousesQuery.data?.find((warehouse) => warehouse.id === form.warehouseId) ||
        warehousesQuery.data?.[0] ||
        null;
      const nextLocation =
        nextWarehouse?.locations.find((item) => item.status === 'ACTIVE') || null;

      setForm({
        ...createEmptyInventoryAdjustmentForm(),
        adjustmentType: form.adjustmentType,
        warehouseId: nextWarehouse?.id || '',
        locationId: nextLocation?.id || '',
      });
      setMessage(`Adjustment ${adjustment.adjustmentCode} posted.`);
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to post inventory adjustment.',
      );
      setMessage(null);
    },
  });

  const adjustments = adjustmentsQuery.data || [];
  const netQuantityDelta = adjustments.reduce(
    (sum, adjustment) => sum + adjustment.totalQuantityDelta,
    0,
  );
  const positiveCount = adjustments.filter(
    (adjustment) =>
      adjustment.adjustmentType === 'OPENING' || adjustment.adjustmentType === 'INCREASE',
  ).length;
  const totalValueDelta = adjustments.reduce(
    (sum, adjustment) => sum + adjustment.totalCostDelta,
    0,
  );

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Adjustments"
        description="Opening stock and manual quantity corrections."
        eyebrow="Inventory Core"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Docs"
          value={adjustments.length}
          description="Posted adjustment records"
          icon={ClipboardList}
        />
        <WmsStatCard
          label="Net Qty"
          value={formatQuantity(netQuantityDelta)}
          description="Total quantity delta"
          icon={Boxes}
          accent="emerald"
        />
        <WmsStatCard
          label="Inbound"
          value={positiveCount}
          description="Opening and increase docs"
          icon={Scale}
          accent="amber"
        />
        <WmsStatCard
          label="Value Delta"
          value={formatMoney(totalValueDelta)}
          description="Net inventory value impact"
          icon={Warehouse}
          accent="orange"
        />
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_440px]">
        <WmsSectionCard title="Adjustment Form">
          <InventoryAdjustmentForm
            warehouses={warehousesQuery.data || []}
            profiledProducts={profiledProductsQuery.data || []}
            value={form}
            disabled={!canCreateAdjustment || createAdjustmentMutation.isPending}
            onChange={setForm}
            onSubmit={() => createAdjustmentMutation.mutate()}
          />
        </WmsSectionCard>

        <WmsSectionCard title="Recent Adjustments" metadata={`${adjustments.length} posted`}>
          <div className="space-y-3">
            {adjustments.slice(0, 8).map((adjustment) => (
              <div key={adjustment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {adjustment.adjustmentCode}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {adjustment.warehouse.code} · {adjustment.location.code}
                    </p>
                  </div>
                  <InventoryAdjustmentStatusBadge status={adjustment.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <InventoryAdjustmentTypeBadge adjustmentType={adjustment.adjustmentType} />
                  <span className="text-xs text-slate-500">{adjustment.reason}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Qty Delta</p>
                    <p
                      className={`font-semibold tabular-nums ${
                        adjustment.totalQuantityDelta >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {adjustment.totalQuantityDelta >= 0 ? '+' : ''}
                      {formatQuantity(adjustment.totalQuantityDelta)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cost Delta</p>
                    <p className="font-semibold tabular-nums text-slate-950">
                      {formatMoney(adjustment.totalCostDelta, adjustment.currency)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  {formatDateTime(adjustment.happenedAt)}
                </div>
              </div>
            ))}

            {!adjustmentsQuery.isLoading && adjustments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No adjustment yet.
              </div>
            ) : null}
          </div>
        </WmsSectionCard>
      </div>
    </div>
  );
}
