
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import type { WmsFulfillmentQueueMode, WmsFulfillmentQueueTask } from '../_types/fulfillment';

type FulfillmentQueueTableProps = {
  mode: WmsFulfillmentQueueMode;
  tasks: WmsFulfillmentQueueTask[];
  isLoading: boolean;
  tenantReady: boolean;
};

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

export function FulfillmentQueueTable({
  mode,
  tasks,
  isLoading,
  tenantReady,
}: FulfillmentQueueTableProps) {
  const [selectedTask, setSelectedTask] = useState<WmsFulfillmentQueueTask | null>(null);
  const actorHeader = mode === 'pick' ? 'Picker' : 'Packer';
  const middleHeader = mode === 'pick' ? 'Basket' : 'Tracking';
  const lastHeader = mode === 'pick' ? 'Warehouse' : 'Basket';
  const columnCount = 8;

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    if (!tenantReady) {
      setSelectedTask(null);
      return;
    }

    const nextTask = tasks.find((task) => task.id === selectedTask.id) ?? null;
    if (!nextTask) {
      setSelectedTask(null);
      return;
    }

    if (nextTask !== selectedTask) {
      setSelectedTask(nextTask);
    }
  }, [selectedTask, tasks, tenantReady]);

  if (!tenantReady) {
    return (
      <QueueTableFrame
        actorHeader={actorHeader}
        middleHeader={middleHeader}
        lastHeader={lastHeader}
      >
        <tbody className="bg-white">
          <tr>
            <td colSpan={columnCount} className="px-5 py-8 text-sm text-[#6f8290]">
              Select a tenant or store scope to load fulfillment work.
            </td>
          </tr>
        </tbody>
      </QueueTableFrame>
    );
  }

  if (isLoading) {
    return (
      <QueueTableFrame
        actorHeader={actorHeader}
        middleHeader={middleHeader}
        lastHeader={lastHeader}
      >
        <tbody className="bg-white">
          {Array.from({ length: 5 }).map((_, index) => (
            <tr key={`loading-${index}`} className="border-b border-[#edf2f6]">
              {Array.from({ length: columnCount }).map((__, cellIndex) => (
                <td key={`loading-${index}-${cellIndex}`} className="px-5 py-4">
                  <div className="h-3.5 animate-pulse rounded-full bg-[#eef2f5]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </QueueTableFrame>
    );
  }

  if (tasks.length === 0) {
    return (
      <QueueTableFrame
        actorHeader={actorHeader}
        middleHeader={middleHeader}
        lastHeader={lastHeader}
      >
        <tbody className="bg-white">
          <tr>
            <td colSpan={columnCount} className="px-5 py-8 text-sm text-[#6f8290]">
              No {mode === 'pick' ? 'pick' : 'pack'} orders are in this view yet.
            </td>
          </tr>
        </tbody>
      </QueueTableFrame>
    );
  }

  const selectedLines = selectedTask ? getVisibleQueueLines(selectedTask) : [];
  const selectedStatusLabel = selectedTask?.delivery?.label ?? selectedTask?.statusLabel ?? '';
  const selectedActor = selectedTask
    ? (mode === 'pick' ? selectedTask.claimedBy?.name : selectedTask.packedBy?.name)
    : null;
  const selectedMiddleValue = selectedTask
    ? (mode === 'pick' ? selectedTask.basket?.barcode ?? 'Unassigned' : selectedTask.tracking ?? 'Awaiting tracking')
    : null;
  const selectedLastValue = selectedTask
    ? (mode === 'pick'
      ? selectedTask.warehouse?.name ?? 'Not assigned'
      : selectedTask.basket?.barcode ?? 'Unassigned')
    : null;

  return (
    <>
      <QueueTableFrame
        actorHeader={actorHeader}
        middleHeader={middleHeader}
        lastHeader={lastHeader}
      >
        <tbody className="bg-white">
          {tasks.map((task) => {
            const statusLabel = task.delivery?.label ?? task.statusLabel;
            const basketLabel = task.basket?.barcode ?? 'Unassigned';
            const actor = mode === 'pick' ? task.claimedBy?.name : task.packedBy?.name;
            const lastColumn = mode === 'pick'
              ? task.warehouse?.name ?? 'Not assigned'
              : basketLabel;

            return (
              <tr
                key={task.id}
                role="button"
                tabIndex={0}
                aria-label={`View order #${task.posOrderId}`}
                onClick={() => setSelectedTask(task)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedTask(task);
                  }
                }}
                className="cursor-pointer border-b border-[#edf2f6] text-[13px] text-primary transition hover:bg-[#fbfcfc] focus:bg-[#f7fafb] focus:outline-none"
              >
                <BodyCell className="min-w-[116px] whitespace-nowrap tabular-nums text-[#4d6677]">
                  {formatOrderDate(task.orderDateLocal, task.orderDate)}
                </BodyCell>

                <BodyCell className="min-w-[220px] font-semibold">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-primary">
                      {`${task.store?.tenantName ?? 'Tenant'}`} &middot;
                      {` ${task.store?.name ?? 'Store'}`} &middot;
                      {` #${task.posOrderId}`}
                    </div>
                    <div className="mt-1 truncate text-[14px] font-semibold text-primary"></div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-primary">{task.customer.name || 'Customer Unavailable'}</div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(statusLabel)}`}>
                    {statusLabel}
                  </span>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-primary">{task.totals.picked}/{task.totals.required}</div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-primary">{actor ?? 'Not started'}</div>
                  </div>
                </BodyCell>

                <BodyCell>
                  {mode === 'pick' ? basketLabel : (task.tracking ?? 'Awaiting tracking')}
                </BodyCell>

                <BodyCell>{lastColumn}</BodyCell>
              </tr>
            );
          })}
        </tbody>
      </QueueTableFrame>

      <WmsModal
        open={selectedTask !== null}
        title={selectedTask ? `Order #${selectedTask.posOrderId}` : 'Order details'}
        description={selectedTask ? `${selectedTask.store?.tenantName ?? 'Tenant'} - ${selectedTask.store?.name ?? 'Store'}` : undefined}
        onClose={() => setSelectedTask(null)}
        bodyClassName="space-y-5"
        footer={(
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedTask(null)}
              className="btn btn-md btn-outline"
            >
              Close
            </button>
          </div>
        )}
      >
        {selectedTask ? (
          <>
            {selectedTask.issueReason ? (
              <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Issue reason</p>
                <p className="mt-1 text-sm text-amber-900">{selectedTask.issueReason}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Required" value={selectedTask.totals.required} />
              <SummaryTile label="Picked" value={selectedTask.totals.picked} />
              <SummaryTile label="Packed" value={selectedTask.totals.packed} />
              <SummaryTile label="Remaining" value={selectedTask.totals.remaining} />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <section className="rounded-xl border border-[#dce4ea] bg-[#fbfcfc] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Order details</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DetailField label="Customer" value={selectedTask.customer.name ?? 'Unavailable'} />
                  <DetailField label="Phone" value={selectedTask.customer.phone ?? 'Unavailable'} />
                  <DetailField label="Status" value={selectedStatusLabel} />
                  <DetailField label="Order date" value={formatOrderDate(selectedTask.orderDateLocal, selectedTask.orderDate)} />
                  <DetailField label="Units" value={`${selectedTask.totals.picked}/${selectedTask.totals.required} picked`} />
                  <DetailField label={actorHeader} value={selectedActor ?? 'Not started'} />
                  <DetailField label={middleHeader} value={selectedMiddleValue ?? 'Unavailable'} />
                  <DetailField label={lastHeader} value={selectedLastValue ?? 'Unavailable'} />
                  <DetailField label="Claimed at" value={formatDateTime(selectedTask.claimedAt)} />
                  <DetailField label="Completed at" value={formatDateTime(selectedTask.completedAt)} />
                </div>
              </section>

              <section className="rounded-xl border border-[#dce4ea] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">Order items</p>
                    <p className="mt-1 text-sm text-[#667a88]">
                      {selectedLines.length} line{selectedLines.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(selectedStatusLabel)}`}>
                    {selectedStatusLabel}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedLines.length > 0 ? selectedLines.map((line) => (
                    <div key={line.id} className="rounded-[18px] border border-[#e8eef2] bg-[#fbfcfc] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-primary">{line.productName}</p>
                          <p className="mt-1 text-xs text-[#6f8290]">
                            {line.productDisplayId ? `Code ${line.productDisplayId}` : 'No product code'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-5">
                        <LineMetric label="Required" value={line.required} />
                        <LineMetric label="Allocated" value={line.allocated} />
                        {/* <LineMetric label="Picked" value={line.picked} />
                        <LineMetric label="Packed" value={line.packed} /> */}
                        <LineMetric label="Shortage" value={line.shortage} />
                      </div>

                      {line.issueReason ? (
                        <p className="mt-3 text-xs text-amber-700">{line.issueReason}</p>
                      ) : null}
                    </div>
                  )) : (
                    <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-4 py-6 text-sm text-[#6f8290]">
                      No order lines available.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </WmsModal>
    </>
  );
}

function QueueTableFrame({
  actorHeader,
  middleHeader,
  lastHeader,
  children,
}: {
  actorHeader: string;
  middleHeader: string;
  lastHeader: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-[#eaf0f4] text-left">
            <HeaderCell>Date</HeaderCell>
            <HeaderCell>Order</HeaderCell>
            <HeaderCell>Customer</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell>Units</HeaderCell>
            <HeaderCell>{actorHeader}</HeaderCell>
            <HeaderCell>{middleHeader}</HeaderCell>
            <HeaderCell>{lastHeader}</HeaderCell>
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

function HeaderCell({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] bg-slate-50 text-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`px-5 py-3 align-middle ${align === 'right' ? 'text-right' : 'text-left'} ${className}`.trim()}
    >
      {children}
    </td>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value">{value}</p>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="card">
      <p className="card-label">{label}</p>
      <p className="card-value text-base">{value}</p>
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
    <div className="rounded-[14px] border border-[#e8eef2] bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8193a0]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-primary">{value}</p>
    </div>
  );
}

function formatOrderDate(dateLocal: string | null, raw: string) {
  if (dateLocal) {
    return dateLocal;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : DATE_FORMATTER.format(parsed);
}

function formatDateTime(raw: string | null) {
  if (!raw) {
    return 'Not available';
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : DATE_TIME_FORMATTER.format(parsed);
}

function getVisibleQueueLines(task: WmsFulfillmentQueueTask) {
  return task.lines.filter((line) => line.status !== 'CANCELED' && line.required > 0);
}

function getStatusTone(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes('delivered')) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (normalized.includes('shipped')) {
    return 'bg-sky-50 text-sky-700';
  }

  if (normalized.includes('pack')) {
    return 'bg-violet-50 text-violet-700';
  }

  if (normalized.includes('restock') || normalized.includes('issue')) {
    return 'bg-amber-50 text-amber-700';
  }

  if (normalized.includes('ready')) {
    return 'bg-success-soft text-success';
  }

  return 'bg-slate-100 text-slate-700';
}
