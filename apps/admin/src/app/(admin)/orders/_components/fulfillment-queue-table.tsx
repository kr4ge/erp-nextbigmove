'use client';

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

export function FulfillmentQueueTable({
  mode,
  tasks,
  isLoading,
  tenantReady,
}: FulfillmentQueueTableProps) {
  if (!tenantReady) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-8 text-sm text-[#6f8290]">
        Select a tenant or store scope to load fulfillment work.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-8 text-sm text-[#6f8290]">
        Loading {mode === 'pick' ? 'pick' : 'pack'} queue...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-8 text-sm text-[#6f8290]">
        No {mode === 'pick' ? 'pick' : 'pack'} orders are in this view yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#dce4ea]">
      <div className="hidden grid-cols-[128px_minmax(0,1.3fr)_120px_116px_120px_140px_132px] gap-3 border-b border-[#dce4ea] bg-[#f7fafb] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b8e9b] lg:grid">
        <span>Date</span>
        <span>Order</span>
        <span>Status</span>
        <span>Units</span>
        <span>{mode === 'pick' ? 'Picker' : 'Packer'}</span>
        <span>{mode === 'pick' ? 'Basket' : 'Tracking'}</span>
        <span>{mode === 'pick' ? 'Warehouse' : 'Basket'}</span>
      </div>

      <div className="divide-y divide-[#eef2f5]">
        {tasks.map((task) => {
          const statusLabel = task.delivery?.label ?? task.statusLabel;
          const basketLabel = task.basket?.barcode ?? 'Unassigned';
          const actor = mode === 'pick' ? task.claimedBy?.name : task.packedBy?.name;
          const lastColumn = mode === 'pick'
            ? task.warehouse?.name ?? 'Not assigned'
            : basketLabel;

          return (
            <div
              key={task.id}
              className="grid gap-3 bg-white px-4 py-4 transition hover:bg-[#fbfcfd] lg:grid-cols-[128px_minmax(0,1.3fr)_120px_116px_120px_140px_132px] lg:px-5"
            >
              <QueueCell label="Date" value={formatOrderDate(task.orderDateLocal, task.orderDate)} />

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a9aa5]">
                  {task.store?.tenantName ?? 'Tenant'} · {task.store?.name ?? 'Store'}
                </p>
                <p className="mt-1 truncate text-[14px] font-semibold text-[#12384b]">#{task.posOrderId}</p>
                <p className="mt-1 truncate text-[12px] text-[#5c7281]">
                  {task.customer.name || 'Customer unavailable'}
                </p>
              </div>

              <div className="flex items-start lg:items-center">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(statusLabel)}`}>
                  {statusLabel}
                </span>
              </div>

              <QueueCell
                label="Units"
                value={`${task.totals.picked}/${task.totals.required}`}
                note={mode === 'pick' ? 'Picked / Required' : 'Packed / Required'}
              />

              <QueueCell
                label={mode === 'pick' ? 'Picker' : 'Packer'}
                value={actor ?? 'Not started'}
                note={actor ? undefined : mode === 'pick' ? 'Not claimed yet' : 'Not packed yet'}
              />

              <QueueCell
                label={mode === 'pick' ? 'Basket' : 'Tracking'}
                value={mode === 'pick' ? basketLabel : (task.tracking ?? 'Awaiting tracking')}
              />

              <QueueCell
                label={mode === 'pick' ? 'Warehouse' : 'Basket'}
                value={lastColumn}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueueCell({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a9aa5] lg:hidden">{label}</p>
      <p className="truncate text-[13px] font-semibold text-[#12384b]">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-[#7b8e9b]">{note}</p> : null}
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
    return 'bg-[#fff7ed] text-[#c2410c]';
  }

  return 'bg-slate-100 text-slate-700';
}
