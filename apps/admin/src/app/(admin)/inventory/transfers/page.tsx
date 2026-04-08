'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Boxes, MoveRight, ScanLine } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsStatCard } from '../../_components/wms-stat-card';
import { useAdminSession } from '../../_hooks/use-admin-session';
import { hasAdminPermission } from '../../_utils/access';
import { fetchWarehouses } from '../../warehouses/_services/warehouses.service';
import {
  createInventoryTransfer,
  fetchInventoryTransfers,
  fetchInventoryUnits,
} from '../_services/inventory.service';
import {
  createEmptyInventoryTransferForm,
  InventoryTransferForm,
} from '../_components/inventory-transfer-form';
import { InventoryTransferTypeBadge } from '../_components/inventory-transfer-type-badge';
import type { CreateWmsInventoryTransferInput } from '../_types/inventory';
import { formatDateTime } from '../_utils/inventory-format';

function getTransferIntentLabel(sourceType?: string | null, destinationType?: string | null) {
  if (sourceType === 'RECEIVING' && destinationType === 'STORAGE') {
    return 'Put-away from receiving to storage';
  }

  if (sourceType && destinationType) {
    return `Relocate ${sourceType.toLowerCase()} to ${destinationType.toLowerCase()}`;
  }

  return 'Select source and destination locations';
}

export default function InventoryTransfersPage() {
  const queryClient = useQueryClient();
  const { user, permissions } = useAdminSession();
  const [form, setForm] = useState<CreateWmsInventoryTransferInput>(
    createEmptyInventoryTransferForm(),
  );
  const [unitSearch, setUnitSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ['wms-warehouses'],
    queryFn: fetchWarehouses,
  });
  const transfersQuery = useQuery({
    queryKey: ['wms-inventory-transfers'],
    queryFn: () => fetchInventoryTransfers({ limit: 20 }),
  });
  const sourceUnitsQuery = useQuery({
    queryKey: [
      'wms-inventory-transfer-source-units',
      form.warehouseId,
      form.fromLocationId,
      unitSearch,
    ],
    queryFn: () =>
      fetchInventoryUnits({
        warehouseId: form.warehouseId || undefined,
        locationId: form.fromLocationId || undefined,
        status: 'AVAILABLE',
        search: unitSearch || undefined,
      }),
    enabled: Boolean(form.warehouseId && form.fromLocationId),
  });

  useEffect(() => {
    if (form.warehouseId || !warehousesQuery.data?.length) {
      return;
    }

    const warehouse = warehousesQuery.data[0];
    const sourceLocation =
      warehouse.locations.find(
        (item) => item.status === 'ACTIVE' && item.type === 'RECEIVING',
      ) ||
      warehouse.locations.find((item) => item.status === 'ACTIVE') ||
      null;
    const destinationLocation =
      warehouse.locations.find(
        (item) =>
          item.status === 'ACTIVE' &&
          item.id !== sourceLocation?.id &&
          item.type === 'STORAGE',
      ) ||
      warehouse.locations.find(
        (item) => item.status === 'ACTIVE' && item.id !== sourceLocation?.id,
      ) ||
      null;

    setForm({
      warehouseId: warehouse.id,
      fromLocationId: sourceLocation?.id || '',
      toLocationId: destinationLocation?.id || '',
      notes: '',
      unitIds: [],
    });
  }, [form.warehouseId, warehousesQuery.data]);

  useEffect(() => {
    setForm((current) => ({ ...current, unitIds: [] }));
  }, [form.fromLocationId]);

  const selectedWarehouse =
    warehousesQuery.data?.find((item) => item.id === form.warehouseId) || null;
  const sourceLocation =
    selectedWarehouse?.locations.find((item) => item.id === form.fromLocationId) ||
    null;
  const destinationLocation =
    selectedWarehouse?.locations.find((item) => item.id === form.toLocationId) ||
    null;
  const sourceUnits = sourceUnitsQuery.data || [];
  const allVisibleSelected =
    sourceUnits.length > 0 &&
    sourceUnits.every((unit) => form.unitIds.includes(unit.id));
  const movedUnits =
    (transfersQuery.data || []).reduce(
      (sum, transfer) => sum + transfer.totalUnits,
      0,
    ) || 0;

  const canCreateTransfer =
    hasAdminPermission(user?.role, permissions, 'wms.inventory.create') ||
    hasAdminPermission(user?.role, permissions, 'wms.inventory.update');

  const createTransferMutation = useMutation({
    mutationFn: () => createInventoryTransfer(form),
    onSuccess: async (transfer) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-transfers'] }),
        queryClient.invalidateQueries({
          queryKey: ['wms-inventory-transfer-source-units'],
        }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-units'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['wms-inventory-ledger'] }),
      ]);

      setForm((current) => ({
        ...current,
        notes: '',
        unitIds: [],
      }));
      setMessage(`Transfer ${transfer.transferCode} posted.`);
      setError(null);
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to post inventory transfer.',
      );
      setMessage(null);
    },
  });

  const toggleUnit = (unitId: string) => {
    setForm((current) => ({
      ...current,
      unitIds: current.unitIds.includes(unitId)
        ? current.unitIds.filter((id) => id !== unitId)
        : [...current.unitIds, unitId],
    }));
  };

  const toggleAllVisible = () => {
    setForm((current) => ({
      ...current,
      unitIds: allVisibleSelected
        ? current.unitIds.filter(
            (unitId) => !sourceUnits.some((unit) => unit.id === unitId),
          )
        : Array.from(
            new Set([
              ...current.unitIds,
              ...sourceUnits.map((unit) => unit.id),
            ]),
          ),
    }));
  };

  const transferIntentLabel = useMemo(
    () => getTransferIntentLabel(sourceLocation?.type, destinationLocation?.type),
    [destinationLocation?.type, sourceLocation?.type],
  );

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Put-away & Transfers"
        description="Move exact serialized units between warehouse locations before allocation."
        eyebrow="Inventory Execution"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <WmsStatCard
          label="Transfers"
          value={transfersQuery.data?.length || 0}
          description="Posted movement documents"
          icon={ArrowRightLeft}
        />
        <WmsStatCard
          label="Moved Units"
          value={movedUnits}
          description="Serialized units transferred"
          icon={MoveRight}
          accent="emerald"
        />
        <WmsStatCard
          label="Ready Here"
          value={sourceUnits.length}
          description="Available units in source"
          icon={Boxes}
          accent="amber"
        />
        <WmsStatCard
          label="Selected"
          value={form.unitIds.length}
          description="Units queued for this post"
          icon={ScanLine}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_430px]">
        <WmsSectionCard title="Transfer Form">
          <InventoryTransferForm
            warehouses={warehousesQuery.data || []}
            sourceUnits={sourceUnits}
            value={form}
            unitSearch={unitSearch}
            intentLabel={transferIntentLabel}
            disabled={!canCreateTransfer || createTransferMutation.isPending}
            allVisibleSelected={allVisibleSelected}
            onChange={setForm}
            onUnitSearchChange={setUnitSearch}
            onToggleUnit={toggleUnit}
            onToggleAllVisible={toggleAllVisible}
            onClearSelection={() =>
              setForm((current) => ({ ...current, unitIds: [] }))
            }
            onSubmit={() => createTransferMutation.mutate()}
          />
        </WmsSectionCard>

        <WmsSectionCard
          title="Recent Transfers"
          metadata={`${transfersQuery.data?.length || 0} posted`}
        >
          <div className="space-y-3">
            {(transfersQuery.data || []).slice(0, 8).map((transfer) => (
              <div
                key={transfer.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {transfer.transferCode}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {transfer.fromLocation.code} → {transfer.toLocation.code}
                    </p>
                  </div>
                  <InventoryTransferTypeBadge
                    transferType={transfer.transferType}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Units</p>
                    <p className="font-semibold tabular-nums text-slate-950">
                      {transfer.totalUnits}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Posted</p>
                    <p className="font-semibold text-slate-950">
                      {formatDateTime(transfer.happenedAt)}
                    </p>
                  </div>
                </div>

                {transfer.items.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {transfer.items.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {item.unitBarcode}
                      </span>
                    ))}
                    {transfer.totalUnits > 3 ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                        +{transfer.totalUnits - 3} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}

            {!transfersQuery.isLoading &&
            (transfersQuery.data || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No transfer yet.
              </div>
            ) : null}
          </div>
        </WmsSectionCard>
      </div>
    </div>
  );
}
