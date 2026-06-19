'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { WmsSidePanel } from '../../_components/wms-side-panel';
import type { WmsDispatchReturnTask, WmsDispatchTab, WmsDispatchTask } from '../_types/dispatch';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const PACKED_EQUIVALENT_UNIT_STATUSES = new Set([
  'PACKED',
  'DISPATCHED',
  'RTS',
  'PUTAWAY',
  'DEADSTOCK',
  'DAMAGED',
  'LOST',
]);

type DispatchDetailPanelProps = {
  tab: WmsDispatchTab;
  outboundTask?: WmsDispatchTask | null;
  returnTask?: WmsDispatchReturnTask | null;
  hasSelection?: boolean;
  isLoading?: boolean;
  canReconcileOutbound?: boolean;
  isReconcilingOutbound?: boolean;
  onReconcileOutboundTask?: (taskId: string) => void | Promise<void> | Promise<boolean>;
  onClose: () => void;
};

export function DispatchDetailPanel({
  tab,
  outboundTask,
  returnTask,
  hasSelection = false,
  isLoading = false,
  canReconcileOutbound = false,
  isReconcilingOutbound = false,
  onReconcileOutboundTask,
  onClose,
}: DispatchDetailPanelProps) {
  const task = tab === 'returns' ? returnTask?.task ?? null : outboundTask ?? null;

  if (!task && !hasSelection) {
    return null;
  }

  if (!task) {
    return (
      <WmsSidePanel
        open={true}
        title={isLoading ? 'Loading order…' : 'Order details unavailable'}
        description={isLoading ? 'Fetching the latest dispatch detail for this order.' : undefined}
        onClose={onClose}
        bodyClassName="space-y-4"
        footer={(
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-md btn-outline"
            >
              Close
            </button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card h-[92px] animate-pulse bg-white" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card h-[132px] animate-pulse bg-white" />
          ))}
        </div>
      </WmsSidePanel>
    );
  }

  const returnFlow = tab === 'returns' ? returnTask?.returnFlow ?? null : null;
  const awaitingPlacementUnits = returnFlow
    ? returnFlow.verifiedUnits.filter((unit) => unit.status === 'RTS')
    : [];
  const placedReturnUnits = returnFlow
    ? returnFlow.verifiedUnits.filter((unit) => unit.status !== 'RTS')
    : [];
  const packedUnitCount = task.unitRecords.filter((unit) => isPackedEquivalentUnit(unit.status)).length;
  const latestPackedAt = resolveLatestPackedAt(task);
  const metrics = [
    { id: 'required', label: 'Required', value: task.totals.required },
    { id: 'packed', label: 'Packed', value: task.totals.packed },
    { id: 'remaining', label: 'Remaining', value: task.totals.remaining },
    {
      id: 'status',
      label: tab === 'returns' ? 'Verified' : 'Dispatch',
      value: tab === 'returns'
        ? `${returnFlow?.verifiedUnits.length ?? 0}/${returnFlow?.expectedUnits ?? 0}`
        : task.delivery?.label ?? task.statusLabel,
    },
  ];
  const actionLinks = [
    { id: 'pick', href: '/orders/pick', label: 'Pick queue', note: 'Open fulfillment pick monitor' },
    { id: 'pack', href: '/orders/pack', label: 'Pack queue', note: 'Review packed basket handoff' },
    { id: 'stock', href: '/inventory/stock', label: 'Stock', note: 'Open serialized stock records' },
  ];

  return (
    <WmsSidePanel
      open={true}
      title={`Order #${task.posOrderId}`}
      description={`${task.store?.tenantName ?? 'Tenant'} · ${task.store?.name ?? 'Store'}`}
      onClose={onClose}
      bodyClassName="space-y-5"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          {tab === 'outbound' && canReconcileOutbound ? (
            <button
              type="button"
              onClick={() => {
                if (!outboundTask || !onReconcileOutboundTask) {
                  return;
                }

                void onReconcileOutboundTask(outboundTask.id);
              }}
              disabled={isReconcilingOutbound}
              className="btn btn-md btn-outline"
            >
              {isReconcilingOutbound ? 'Repairing…' : 'Repair order sync'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-md btn-outline"
          >
            Close
          </button>
        </div>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.id} label={metric.label} value={metric.value} />
        ))}
      </div>

      <DetailSection title="Quick links" description="Open the related WMS workspaces for this order.">
        <div className="grid gap-3 sm:grid-cols-3">
          {actionLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 transition hover:border-[#c9d6de] hover:bg-white"
            >
              <p className="text-[14px] font-semibold text-primary">{link.label}</p>
              <p className="mt-1 text-[12px] text-[#68808f]">{link.note}</p>
            </Link>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Handling" description="Dispatch, waybill, and assignment context for this order.">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailCard label="Customer" value={task.customer.name ?? 'Unknown customer'} />
          <DetailCard label="Phone" value={task.customer.phone ?? 'Not provided'} />
          <DetailCard label="Order date" value={formatDate(task.orderDateLocal ?? task.orderDate)} />
          <DetailCard label="Waybill" value={task.tracking ?? 'Awaiting tracking'} mono={Boolean(task.tracking)} />
          <DetailCard label="Store" value={task.store?.name ?? 'Unassigned'} />
          <DetailCard label="Warehouse" value={task.warehouse?.name ?? 'Not assigned'} />
          <DetailCard label="Dispatch status" value={task.delivery?.label ?? task.statusLabel} />
          <DetailCard label="Order picker" value={task.claimedBy?.name ?? 'Not assigned'} />
          <DetailCard label="Order packer" value={task.packedBy?.name ?? 'Not assigned'} />
          <DetailCard label="Claimed at" value={formatDateTime(task.claimedAt)} />
          <DetailCard label="Latest packed at" value={formatDateTime(latestPackedAt)} />
          <DetailCard label="Delivered at" value={formatDateTime(task.delivery?.deliveredAt ?? null)} />
          {tab === 'returns' ? (
            <DetailCard label="Returning at" value={formatDateTime(task.delivery?.rtsAt ?? null)} />
          ) : null}
        </div>
      </DetailSection>

      {task.basket ? (
        <DetailSection title="Basket" description="The current basket container and its live capacity state.">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailCard label="Basket" value={task.basket.barcode} mono />
            <DetailCard label="Basket status" value={task.basket.statusLabel} />
            <DetailCard label="Basket warehouse" value={task.basket.warehouse?.name ?? 'Not assigned'} />
            <DetailCard
              label="Capacity"
              value={`${task.basket.currentFulfillmentOrders}/${task.basket.maxFulfillmentOrders}`}
            />
            <DetailCard label="Basket picker" value={task.basket.assignedPicker?.name ?? 'Not assigned'} />
            <DetailCard label="Basket packer" value={task.basket.assignedPacker?.name ?? 'Not assigned'} />
            <DetailCard label="Claimed at" value={formatDateTime(task.basket.claimedAt)} />
            <DetailCard label="Full at" value={formatDateTime(task.basket.fullAt)} />
            <DetailCard label="Ready for pack" value={formatDateTime(task.basket.readyForPackAt)} />
          </div>
        </DetailSection>
      ) : null}

      {returnFlow ? (
        <>
          <DetailSection title="Return progress" description="Track return backlog, final placement state, and the completed RTS owner.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Expected" value={returnFlow.expectedUnits} />
              <MetricCard label="Pending scan" value={returnFlow.pendingUnits.length} />
              <MetricCard label="Awaiting placement" value={returnFlow.awaitingPlacementUnits} />
              <MetricCard label="Placed" value={returnFlow.placedUnits} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="State" value={returnFlow.label ?? returnFlow.posStatusLabel ?? 'Not started'} />
              <DetailCard
                label="Disposed at"
                value={returnFlow.disposedAt ? formatDateTime(returnFlow.disposedAt) : 'Not completed yet'}
              />
              <DetailCard
                label="Disposed by"
                value={returnFlow.disposedBy?.name ?? returnFlow.disposedBy?.email ?? 'Not assigned'}
              />
            </div>
          </DetailSection>

          <DetailSection title="Return units" description="Split returned units by what still needs scanning, what is waiting for a bin/disposition, and what is already placed.">
            <div className="grid gap-4 xl:grid-cols-3">
              <ReturnUnitList title="Pending units" emptyMessage="No pending units." units={returnFlow.pendingUnits} />
              <ReturnUnitList title="Awaiting placement" emptyMessage="No units are waiting for placement." units={awaitingPlacementUnits} />
              <ReturnUnitList title="Placed units" emptyMessage="No units have been placed yet." units={placedReturnUnits} />
            </div>
          </DetailSection>

          <DetailSection title="Return history" description="Audit trail for RTS verification and placement actions on this order.">
            <HistoryList history={returnFlow.history} />
          </DetailSection>
        </>
      ) : (
        <DetailSection
          title={`Packed units · ${task.unitRecords.length} unit${task.unitRecords.length === 1 ? '' : 's'}`}
          description={`${packedUnitCount} unit${packedUnitCount === 1 ? '' : 's'} already packed or dispatched for this order.`}
        >
          <UnitRecordList units={task.unitRecords} />
        </DetailSection>
      )}

      <DetailSection title={`Order items · ${task.lines.length} line${task.lines.length === 1 ? '' : 's'}`}>
        <div className="space-y-3">
          {task.lines.map((line) => (
            <div
              key={line.id}
              className="rounded-[20px] border border-[#dce4ea] bg-white px-4 py-4 shadow-[0_10px_24px_-24px_rgba(18,56,75,0.45)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-primary">{line.productName}</p>
                  <p className="mt-1 text-[12px] text-[#667d8d]">
                    {line.productDisplayId ? `Code ${line.productDisplayId}` : 'No product code'}
                  </p>
                </div>
                <span className={buildPillClass(line.status)}>
                  {line.statusLabel}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <LineMetric label="Required" value={line.required} />
                <LineMetric label="Picked" value={line.picked} />
                <LineMetric label="Packed" value={line.packed} />
                <LineMetric label="Shortage" value={line.shortage} />
              </div>
            </div>
          ))}
        </div>
      </DetailSection>
    </WmsSidePanel>
  );
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-[#dce4ea] bg-white p-5 shadow-[0_20px_48px_-40px_rgba(18,56,75,0.42)]">
      <p className="card-label">{title}</p>
      {description ? <p className="mt-1 text-[13px] text-[#68808f]">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value">{value}</p>
    </div>
  );
}

function DetailCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-[#e2e9ee] bg-[#fbfcfc] px-4 py-3">
      <p className="card-label">{label}</p>
      <div className={`mt-2 text-[15px] font-semibold text-primary ${mono ? 'font-mono tracking-[-0.01em]' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function UnitRecordList({
  units,
}: {
  units: WmsDispatchTask['unitRecords'];
}) {
  if (units.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-4 py-6 text-sm text-[#6f8290]">
        No packed unit records are linked to this order yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {units.map((unit) => (
        <div
          key={unit.id}
          className="rounded-[20px] border border-[#e6edf1] bg-[#fbfcfc] px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-primary">{unit.name}</p>
              <p className="mt-1 text-[12px] text-[#667d8d]">
                {unit.customId ? `Code ${unit.customId}` : 'Serialized stock unit'}
              </p>
            </div>
            <span className={buildPillClass(unit.status)}>
              {unit.statusLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MiniInfo label="Unit" value={unit.code} mono />
            <MiniInfo label="Barcode" value={unit.barcode} mono />
            <MiniInfo label="Picked at" value={formatDateTime(unit.pickedAt)} />
            <MiniInfo label="Packed at" value={formatDateTime(unit.packedAt)} />
            <MiniInfo label="Picked by" value={unit.pickedBy?.name ?? 'Not recorded'} />
            <MiniInfo label="Packed by" value={unit.packedBy?.name ?? 'Not recorded'} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReturnUnitList({
  title,
  emptyMessage,
  units,
}: {
  title: string;
  emptyMessage: string;
  units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    statusLabel: string;
    name: string;
    customId: string | null;
    currentLocation: {
      id: string;
      code: string;
      name: string;
    } | null;
  }>;
}) {
  return (
    <div className="rounded-[20px] border border-[#e6edf1] bg-[#fbfcfc] p-4">
      <p className="card-label">{title}</p>
      <div className="mt-3 space-y-3">
        {units.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#d7e0e7] bg-white px-4 py-5 text-sm text-[#6f8290]">
            {emptyMessage}
          </div>
        ) : (
          units.map((unit) => (
            <div key={unit.id} className="rounded-[16px] border border-[#e4ebef] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-primary">{unit.name}</p>
                  <p className="mt-1 text-[12px] text-[#667d8d]">
                    {unit.customId ? `Code ${unit.customId}` : 'Returned stock unit'}
                  </p>
                </div>
                <span className={buildPillClass(unit.status)}>
                  {unit.statusLabel}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniInfo label="Unit" value={unit.code} mono />
                <MiniInfo label="Barcode" value={unit.barcode} mono />
                {unit.currentLocation ? (
                  <MiniInfo label="Location" value={`${unit.currentLocation.code} · ${unit.currentLocation.name}`} />
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function HistoryList({
  history,
}: {
  history: Array<{
    id: string;
    label: string;
    detail: string | null;
    createdAt: string;
    actor: {
      name: string;
      email: string;
    } | null;
  }>;
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-4 py-6 text-sm text-[#6f8290]">
        No return verification activity has been recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div key={entry.id} className="rounded-[18px] border border-[#e6edf1] bg-[#fbfcfc] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-primary">{entry.label}</p>
              <p className="mt-1 text-[12px] text-[#68808f]">
                {entry.actor?.name ?? entry.actor?.email ?? 'WMS staff'} · {formatDateTime(entry.createdAt)}
              </p>
            </div>
          </div>
          {entry.detail ? (
            <p className="mt-3 text-[13px] text-[#4f6574]">{entry.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MiniInfo({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[#e2e9ee] bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8193a0]">{label}</p>
      <p className={`mt-2 text-[13px] font-semibold text-primary ${mono ? 'font-mono tracking-[-0.01em]' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function LineMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[14px] border border-[#e2e9ee] bg-[#fbfcfc] px-3 py-3">
      <p className="card-label">{label}</p>
      <p className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-primary">{value}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return 'N/A';
  }

  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? value : DATE_FORMATTER.format(nextDate);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'N/A';
  }

  const nextDate = new Date(value);
  return Number.isNaN(nextDate.getTime()) ? value : DATE_TIME_FORMATTER.format(nextDate);
}

function resolveLatestPackedAt(task: WmsDispatchTask) {
  const timestamps = task.unitRecords
    .map((unit) => unit.packedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  if (timestamps.length > 0) {
    return timestamps[0].toISOString();
  }

  return task.completedAt ?? null;
}

function isPackedEquivalentUnit(status: string | null | undefined) {
  return status ? PACKED_EQUIVALENT_UNIT_STATUSES.has(status) : false;
}

function buildPillClass(status: string | null | undefined) {
  switch (status) {
    case 'PACKED':
    case 'DISPATCHED':
    case 'SHIPPED':
      return 'pill pill-info';
    case 'DELIVERED':
    case 'PUTAWAY':
    case 'VERIFIED':
      return 'pill pill-success';
    case 'READY':
    case 'READY_FOR_PACK':
      return 'pill pill-primary';
    case 'PARTIAL':
    case 'RETURNING':
    case 'AWAITING_PLACEMENT':
    case 'RTS':
      return 'pill border-none bg-[#fff4db] text-[#a66313]';
    case 'RETURNED':
    case 'CANCELED':
    case 'DAMAGED':
    case 'LOST':
    case 'DEADSTOCK':
      return 'pill pill-destructive';
    default:
      return 'pill pill-neutral';
  }
}
