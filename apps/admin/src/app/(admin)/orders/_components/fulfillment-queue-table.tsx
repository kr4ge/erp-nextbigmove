'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { WmsSidePanel } from '../../_components/wms-side-panel';
import type {
  WmsFulfillmentHeldBasket,
  WmsFulfillmentQueueMode,
  WmsFulfillmentQueueTask,
} from '../_types/fulfillment';
import {
  buildHeldBasketRows,
  buildFulfillmentQueueRows,
  type WmsFulfillmentBasketRow,
  type WmsFulfillmentQueueRow,
} from './fulfillment-queue-rows';

type FulfillmentQueueTableProps = {
  mode: WmsFulfillmentQueueMode;
  tasks: WmsFulfillmentQueueTask[];
  heldBaskets?: WmsFulfillmentHeldBasket[];
  isLoading: boolean;
  tenantReady: boolean;
  pickView?: PickQueueView;
  canVoidPickBaskets?: boolean;
  isVoidingPickBasket?: boolean;
  onVoidPickBasket?: (basketId: string) => Promise<boolean> | boolean;
};

type PickQueueView = 'orders' | 'baskets';

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
  heldBaskets = [],
  isLoading,
  tenantReady,
  pickView = 'orders',
  canVoidPickBaskets = false,
  isVoidingPickBasket = false,
  onVoidPickBasket,
}: FulfillmentQueueTableProps) {
  const [selection, setSelection] = useState<{ kind: 'task' | 'basket'; id: string } | null>(null);
  const [confirmVoidBasketId, setConfirmVoidBasketId] = useState<string | null>(null);
  const actorHeader = mode === 'pick' ? 'Picker' : 'Packer';
  const basketRows = useMemo(
    () => (mode === 'pick'
      ? buildHeldBasketRows(heldBaskets).filter((row) => ACTIVE_PICK_BASKET_STATUSES.has(row.basket.status))
      : []),
    [heldBaskets, mode],
  );
  const taskRows = useMemo(() => buildFulfillmentQueueRows(mode, tasks), [mode, tasks]);
  const isBasketView = mode === 'pick' && pickView === 'baskets';
  const rows = useMemo<WmsFulfillmentQueueRow[]>(
    () => (isBasketView ? basketRows : taskRows),
    [basketRows, isBasketView, taskRows],
  );
  const selectedRow = useMemo(() => {
    if (!selection) {
      return null;
    }

    return rows.find((row) => (
      row.kind === selection.kind
        && (row.kind === 'basket' ? row.basket.id : row.task.id) === selection.id
    )) ?? null;
  }, [rows, selection]);

  useEffect(() => {
    if (!tenantReady) {
      setSelection(null);
      setConfirmVoidBasketId(null);
      return;
    }

    if (!selection) {
      return;
    }

    if (!selectedRow) {
      setSelection(null);
      setConfirmVoidBasketId(null);
    }
  }, [selectedRow, selection, tenantReady]);

  useEffect(() => {
    const selectedBasketId = selectedRow?.kind === 'basket' ? selectedRow.basket.id : null;
    if (confirmVoidBasketId && confirmVoidBasketId !== selectedBasketId) {
      setConfirmVoidBasketId(null);
    }
  }, [confirmVoidBasketId, selectedRow]);

  const primaryHeader = isBasketView ? 'Basket' : 'Order';
  const secondaryHeader = isBasketView ? 'Orders' : 'Customer';
  const middleHeader = mode === 'pick'
    ? (isBasketView ? 'Capacity' : 'Basket')
    : 'Tracking';
  const lastHeader = mode === 'pick' ? 'Warehouse' : 'Basket';
  const columnCount = 8;

  const selectedTask = selectedRow?.kind === 'task' ? selectedRow.task : null;
  const selectedBasket = selectedRow?.kind === 'basket' ? selectedRow : null;
  const selectedLines = selectedTask ? getVisibleQueueLines(selectedTask) : [];
  const selectedStatusLabel = selectedTask?.delivery?.label ?? selectedTask?.statusLabel ?? selectedBasket?.basket.statusLabel ?? '';
  const selectedActor = selectedTask
    ? (mode === 'pick' ? selectedTask.claimedBy?.name : selectedTask.packedBy?.name)
    : selectedBasket?.basket.assignedPicker?.name ?? null;
  const selectedMiddleValue = selectedTask
    ? (mode === 'pick' ? selectedTask.basket?.barcode ?? 'Unassigned' : selectedTask.tracking ?? 'Awaiting tracking')
    : selectedBasket?.basket.activeFulfillmentOrders
      ? `${selectedBasket.basket.activeFulfillmentOrders}/${selectedBasket.basket.maxFulfillmentOrders}`
      : `${selectedBasket?.basket.orders.length ?? 0}/${selectedBasket?.basket.maxFulfillmentOrders ?? 0}`;
  const selectedLastValue = selectedTask
    ? (mode === 'pick'
      ? selectedTask.warehouse?.name ?? 'Not assigned'
      : selectedTask.basket?.barcode ?? 'Unassigned')
    : selectedBasket?.basket.warehouse?.name ?? 'Not assigned';

  const selectedBasketOrders = useMemo(() => {
    if (!selectedBasket) {
      return [];
    }

    const orders = selectedBasket.basket.orders.length > 0
      ? selectedBasket.basket.orders
      : selectedBasket.tasks.map((task) => ({
        id: task.id,
        posOrderId: task.posOrderId,
        status: task.status,
        statusLabel: task.statusLabel,
        customerName: task.customer.name,
        totals: {
          required: task.totals.required,
          picked: task.totals.picked,
        },
        store: task.store,
      }));

    return [...orders].sort((left, right) => {
      const leftOrder = left.posOrderId ?? '';
      const rightOrder = right.posOrderId ?? '';
      return leftOrder.localeCompare(rightOrder, undefined, { numeric: true });
    });
  }, [selectedBasket]);

  return (
    <>
      <QueueTableFrame
        actorHeader={actorHeader}
        middleHeader={middleHeader}
        lastHeader={lastHeader}
        primaryHeader={primaryHeader}
        secondaryHeader={secondaryHeader}
      >
        <tbody className="bg-white">
          {!tenantReady ? (
            <tr>
              <td colSpan={columnCount} className="px-5 py-8 text-sm text-[#6f8290]">
                Select a tenant or store scope to load fulfillment work.
              </td>
            </tr>
          ) : isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={`loading-${index}`} className="border-b border-[#edf2f6]">
                {Array.from({ length: columnCount }).map((__, cellIndex) => (
                  <td key={`loading-${index}-${cellIndex}`} className="px-5 py-4">
                    <div className="h-3.5 animate-pulse rounded-full bg-[#eef2f5]" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-5 py-8 text-sm text-[#6f8290]">
                {isBasketView
                  ? 'No active baskets are in this view yet.'
                  : `No ${mode === 'pick' ? 'pick' : 'pack'} orders are in this view yet.`}
              </td>
            </tr>
          ) : rows.map((row) => (
            row.kind === 'basket'
              ? (
                <BasketRow
                  key={row.key}
                  row={row}
                  onSelect={() => setSelection({ kind: 'basket', id: row.basket.id })}
                />
              )
              : (
                <TaskRow
                  key={row.key}
                  mode={mode}
                  task={row.task}
                  onSelect={() => setSelection({ kind: 'task', id: row.task.id })}
                />
              )
          ))}
        </tbody>
      </QueueTableFrame>

      <WmsSidePanel
        open={selectedRow !== null}
        title={selectedBasket ? `Basket ${selectedBasket.basket.barcode}` : selectedTask ? `Order #${selectedTask.posOrderId}` : 'Queue details'}
        description={selectedBasket
          ? buildBasketDescription(selectedBasket)
          : selectedTask
            ? `${selectedTask.store?.tenantName ?? 'Tenant'} · ${selectedTask.store?.name ?? 'Store'}`
            : undefined}
        onClose={() => {
          setSelection(null);
          setConfirmVoidBasketId(null);
        }}
        bodyClassName="space-y-4"
        footer={selectedBasket ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {confirmVoidBasketId === selectedBasket.basket.id ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmVoidBasketId(null)}
                  className="btn btn-md btn-outline"
                  disabled={isVoidingPickBasket}
                >
                  Keep basket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!onVoidPickBasket) {
                      return;
                    }

                    void Promise.resolve(onVoidPickBasket(selectedBasket.basket.id)).then((success) => {
                      if (success) {
                        setSelection(null);
                        setConfirmVoidBasketId(null);
                      }
                    });
                  }}
                  disabled={isVoidingPickBasket}
                  className="inline-flex h-11 items-center justify-center rounded-[16px] border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVoidingPickBasket ? 'Voiding…' : 'Confirm void'}
                </button>
              </>
            ) : (
              <>
                {canVoidPickBaskets ? (
                  <button
                    type="button"
                    onClick={() => setConfirmVoidBasketId(selectedBasket.basket.id)}
                    className="inline-flex h-11 items-center justify-center rounded-[16px] border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Void basket
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="btn btn-md btn-outline"
                >
                  Close
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="btn btn-md btn-outline"
            >
              Close
            </button>
          </div>
        )}
      >
        {selectedBasket ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TopMetaCard
                label="Status"
                value={(
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(selectedBasket.basket.statusLabel)}`}>
                    {selectedBasket.basket.statusLabel}
                  </span>
                )}
              />
              <TopMetaCard
                label="Claimed at"
                value={<span className="text-sm font-semibold text-primary">{formatDateTime(selectedBasket.basket.claimedAt)}</span>}
              />
            </div>

            {confirmVoidBasketId === selectedBasket.basket.id ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Void will release this basket, return picked units to their original bins, and re-evaluate every order inside it.
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Orders" value={selectedBasketOrders.length} />
              <SummaryTile label="Required" value={selectedBasket.totals.required} />
              <SummaryTile label="Picked" value={selectedBasket.totals.picked} />
              <SummaryTile label="Remaining" value={selectedBasket.totals.remaining} />
            </div>

            <DetailSection title="Basket overview" description="Live basket progress and assignment details.">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Picker" value={selectedActor ?? 'Not started'} />
                <InfoCard label="Warehouse" value={selectedLastValue ?? 'Not assigned'} />
                <InfoCard label="Capacity" value={selectedMiddleValue ?? '0/0'} />
                <InfoCard label="Ready for pack" value={formatDateTime(selectedBasket.basket.readyForPackAt)} />
              </div>
            </DetailSection>

            <DetailSection
              title="Orders in basket"
              description={`${selectedBasketOrders.length} order${selectedBasketOrders.length === 1 ? '' : 's'} currently linked to this basket.`}
            >
              <div className="space-y-3">
                {selectedBasketOrders.map((order) => (
                  <div key={order.id} className="rounded-[20px] border border-[#e6edf1] bg-[#fbfcfc] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary">
                          #{order.posOrderId ?? 'Unknown'}
                        </p>
                        <p className="mt-1 truncate text-[13px] text-[#667a88]">
                          {order.store?.tenantName ?? 'Tenant'} · {order.store?.name ?? 'Store'}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(order.statusLabel ?? order.status ?? '')}`}>
                        {order.statusLabel ?? order.status ?? 'Unknown'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <LineMetric label="Required" value={order.totals.required} />
                      <LineMetric label="Picked" value={order.totals.picked} />
                      <LineMetric label="Remaining" value={Math.max(order.totals.required - order.totals.picked, 0)} />
                    </div>

                    <p className="mt-3 text-[13px] text-[#667a88]">
                      Customer: <span className="font-semibold text-primary">{order.customerName ?? 'Unavailable'}</span>
                    </p>
                  </div>
                ))}
              </div>
            </DetailSection>
          </>
        ) : selectedTask ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TopMetaCard
                label="Status"
                value={(
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(selectedStatusLabel)}`}>
                    {selectedStatusLabel}
                  </span>
                )}
              />
              <TopMetaCard
                label={mode === 'pick' ? 'Order date' : 'Tracking'}
                value={(
                  <span className="text-sm font-semibold text-primary">
                    {mode === 'pick'
                      ? formatOrderDate(selectedTask.orderDateLocal, selectedTask.orderDate)
                      : selectedTask.tracking ?? 'Awaiting tracking'}
                  </span>
                )}
              />
            </div>

            {selectedTask.issueReason ? (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
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

            <DetailSection title="Order summary" description="Core order details and current queue assignment.">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Customer" value={selectedTask.customer.name ?? 'Unavailable'} />
                <InfoCard label="Phone" value={selectedTask.customer.phone ?? 'Unavailable'} />
                <InfoCard label={actorHeader} value={selectedActor ?? 'Not started'} />
                <InfoCard label={middleHeader} value={selectedMiddleValue ?? 'Unavailable'} />
                <InfoCard label={lastHeader} value={selectedLastValue ?? 'Unavailable'} />
                <InfoCard label="Claimed at" value={formatDateTime(selectedTask.claimedAt)} />
                <InfoCard label="Completed at" value={formatDateTime(selectedTask.completedAt)} />
                <InfoCard label="Units" value={`${selectedTask.totals.picked}/${selectedTask.totals.required} picked`} />
              </div>
            </DetailSection>

            <DetailSection
              title="Order items"
              description={`${selectedLines.length} line${selectedLines.length === 1 ? '' : 's'} currently visible in this order.`}
            >
              {selectedLines.length > 0 ? (
                <div className="space-y-3">
                  {selectedLines.map((line) => (
                    <div key={line.id} className="rounded-[20px] border border-[#e6edf1] bg-[#fbfcfc] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-primary">{line.productName}</p>
                          <p className="mt-1 text-[13px] text-[#667a88]">
                            {line.productDisplayId ? `Code ${line.productDisplayId}` : 'No product code'}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(line.statusLabel)}`}>
                          {line.statusLabel}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <LineMetric label="Required" value={line.required} />
                        <LineMetric label="Allocated" value={line.allocated} />
                        <LineMetric label="Shortage" value={line.shortage} />
                      </div>

                      {line.issueReason ? (
                        <p className="mt-3 text-xs text-amber-700">{line.issueReason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-4 py-6 text-sm text-[#6f8290]">
                  No order lines available.
                </div>
              )}
            </DetailSection>
          </>
        ) : null}
      </WmsSidePanel>
    </>
  );
}

function TaskRow({
  mode,
  task,
  onSelect,
}: {
  mode: WmsFulfillmentQueueMode;
  task: WmsFulfillmentQueueTask;
  onSelect: () => void;
}) {
  const statusLabel = task.delivery?.label ?? task.statusLabel;
  const basketLabel = task.basket?.barcode ?? 'Unassigned';
  const actor = mode === 'pick' ? task.claimedBy?.name : task.packedBy?.name;
  const lastColumn = mode === 'pick'
    ? task.warehouse?.name ?? 'Not assigned'
    : basketLabel;

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`View order #${task.posOrderId}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
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
            {`${task.store?.tenantName ?? 'Tenant'} · ${task.store?.name ?? 'Store'} · #${task.posOrderId}`}
          </div>
        </div>
      </BodyCell>

      <BodyCell>
        <div className="min-w-0">
          <div className="truncate font-semibold text-primary">{task.customer.name || 'Customer unavailable'}</div>
        </div>
      </BodyCell>

      <BodyCell>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(statusLabel)}`}>
          {statusLabel}
        </span>
      </BodyCell>

      <BodyCell>
        <div className="truncate font-semibold text-primary">{task.totals.picked}/{task.totals.required}</div>
      </BodyCell>

      <BodyCell>
        <div className="truncate font-semibold text-primary">{actor ?? 'Not started'}</div>
      </BodyCell>

      <BodyCell>
        {mode === 'pick' ? basketLabel : (task.tracking ?? 'Awaiting tracking')}
      </BodyCell>

      <BodyCell>{lastColumn}</BodyCell>
    </tr>
  );
}

function BasketRow({
  row,
  onSelect,
}: {
  row: WmsFulfillmentBasketRow;
  onSelect: () => void;
}) {
  const orderCount = row.basket.orders.length > 0 ? row.basket.orders.length : row.tasks.length;
  const previewCustomers = row.basket.orders
    .map((order) => order.customerName)
    .filter((name): name is string => Boolean(name))
    .slice(0, 2)
    .join(', ');
  const primaryStore = row.basket.orders[0]?.store ?? row.tasks[0]?.store;
  const activeOrders = row.basket.activeFulfillmentOrders > 0
    ? row.basket.activeFulfillmentOrders
    : orderCount;

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`View basket ${row.basket.barcode}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer border-b border-[#edf2f6] text-[13px] text-primary transition hover:bg-[#fbfcfc] focus:bg-[#f7fafb] focus:outline-none"
    >
      <BodyCell className="min-w-[116px] whitespace-nowrap tabular-nums text-[#4d6677]">
        {formatOrderDate(row.orderDateLocal, row.orderDate)}
      </BodyCell>

      <BodyCell className="min-w-[220px] font-semibold">
        <div className="min-w-0">
          <div className="truncate font-semibold text-primary">{row.basket.barcode}</div>
          <div className="mt-1 truncate text-[12px] text-[#6f8290]">
            {primaryStore?.tenantName ?? 'Tenant'} · {primaryStore?.name ?? 'Store'}
          </div>
        </div>
      </BodyCell>

      <BodyCell>
        <div className="min-w-0">
          <div className="truncate font-semibold text-primary">
            {orderCount} order{orderCount === 1 ? '' : 's'}
          </div>
          <div className="mt-1 truncate text-[12px] text-[#6f8290]">
            {previewCustomers || 'Active basket work'}
          </div>
        </div>
      </BodyCell>

      <BodyCell>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(row.basket.statusLabel)}`}>
          {row.basket.statusLabel}
        </span>
      </BodyCell>

      <BodyCell>
        <div className="truncate font-semibold text-primary">{row.totals.picked}/{row.totals.required}</div>
      </BodyCell>

      <BodyCell>
        <div className="truncate font-semibold text-primary">{row.basket.assignedPicker?.name ?? 'Not started'}</div>
      </BodyCell>

      <BodyCell>
        <div className="truncate font-semibold text-primary">{activeOrders}/{row.basket.maxFulfillmentOrders}</div>
      </BodyCell>

      <BodyCell>{row.basket.warehouse?.name ?? 'Not assigned'}</BodyCell>
    </tr>
  );
}

function QueueTableFrame({
  actorHeader,
  middleHeader,
  lastHeader,
  primaryHeader,
  secondaryHeader,
  children,
}: {
  actorHeader: string;
  middleHeader: string;
  lastHeader: string;
  primaryHeader: string;
  secondaryHeader: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-[#eaf0f4] text-left">
            <HeaderCell>Date</HeaderCell>
            <HeaderCell>{primaryHeader}</HeaderCell>
            <HeaderCell>{secondaryHeader}</HeaderCell>
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
      className={`bg-slate-50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted ${
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

function TopMetaCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[#dce4ea] bg-white px-4 py-3 shadow-[0_16px_30px_-32px_rgba(18,56,75,0.55)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">{label}</p>
      <div className="mt-2 min-h-[24px]">{value}</div>
    </div>
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
    <section className="rounded-[24px] border border-[#dce4ea] bg-white p-4 shadow-[0_18px_34px_-34px_rgba(18,56,75,0.58)]">
      <div>
        <p className="text-base font-semibold tracking-[-0.02em] text-primary">{title}</p>
        {description ? <p className="mt-1 text-[13px] text-[#667a88]">{description}</p> : null}
      </div>

      <div className="mt-4">{children}</div>
    </section>
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
    <div className="rounded-[20px] border border-[#dce4ea] bg-white px-4 py-3 shadow-[0_16px_30px_-32px_rgba(18,56,75,0.55)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8193a0]">{label}</p>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-primary">{value}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#e6edf1] bg-[#fbfcfc] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8193a0]">{label}</p>
      <p className="mt-2 break-words text-[15px] font-semibold leading-snug text-primary">{value}</p>
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

function buildBasketDescription(row: WmsFulfillmentBasketRow) {
  const primaryStore = row.basket.orders[0]?.store ?? row.tasks[0]?.store;
  const warehouseName = row.basket.warehouse?.name;
  const descriptionParts = [
    primaryStore?.tenantName ?? 'Tenant',
    primaryStore?.name ?? `${row.basket.orders.length} orders`,
  ];

  if (warehouseName) {
    descriptionParts.push(warehouseName);
  }

  return descriptionParts.join(' · ');
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

const ACTIVE_PICK_BASKET_STATUSES = new Set(['ASSIGNED', 'IN_PICKING']);
