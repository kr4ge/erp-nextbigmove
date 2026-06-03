'use client';

import type { WmsFulfillmentQueueTask } from '../_types/fulfillment';

type FulfillmentPackQueueListProps = {
  activeTaskId: string | null;
  tasks: WmsFulfillmentQueueTask[];
  isLoading: boolean;
  tenantReady: boolean;
  onSelectTask: (taskId: string) => void;
};

export function FulfillmentPackQueueList({
  activeTaskId,
  tasks,
  isLoading,
  tenantReady,
  onSelectTask,
}: FulfillmentPackQueueListProps) {
  if (!tenantReady) {
    return <div className="p-3">
      <EmptyState copy="Select a tenant or store scope to load the pack queue." />
    </div>
  }

  if (isLoading) {
    return <div className="p-3">
      <EmptyState copy="Loading pack queue..." />;
    </div>
  }

  if (tasks.length === 0) {
    return <div className="p-3">
      <EmptyState copy="No pack orders are in this view yet." />
    </div>
  }

  return (
    <div className="space-y-3 p-3">
      {tasks.map((task) => {
        const active = activeTaskId === task.id;
        const tracking = task.tracking?.trim() || null;
        const summary = getVisiblePackLines(task.lines)
          .slice(0, 2)
          .map((line) => `${line.required}x ${line.productName}`)
          .join(' • ');
        const statusLabel = mapPackCardStatus(task, task.basket?.statusLabel ?? task.statusLabel, tracking);

        return (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelectTask(task.id)}
            className={`card w-full text-left transition ${
              active
                ? 'border-[#12384b] bg-[#f7fafb] shadow-[0_24px_50px_-40px_rgba(18,56,75,0.4)]'
                : 'border-[#dce4ea] bg-white hover:border-[#c8d6df] hover:bg-[#fbfcfd]'
            }`}
          >
            <div className="flex justify-between">
              <p className="mt-1 truncate text-sm-custom 2xl:text-base font-semibold text-[#12384b]">{task.store?.name ?? 'Store'} &middot; #{task.posOrderId}</p>
              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(statusLabel)}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mt-1 truncate text-xs text-[#6b7d89]">
                  {tracking ? `Tracking ${tracking}` : 'Awaiting tracking print'}
                </p>
              </div>
            </div>

            <p className="mt-3 line-clamp-2 text-[13px] text-[#12384b]">
              {summary || `${task.totals.required} required unit${task.totals.required === 1 ? '' : 's'}`}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#718592]">
              <span>
                {formatOrderDate(task.orderDateLocal ?? task.orderDate)} &middot; 
                {` ${task.totals.packed}/${task.totals.required}`} &middot; 
                {` ${task.basket?.barcode ?? 'None'}`}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#d7e0e7] bg-[#fbfcfc] px-5 py-8 text-sm text-[#6f8290]">
      {copy}
    </div>
  );
}

function getVisiblePackLines(lines: WmsFulfillmentQueueTask['lines']) {
  return lines.filter((line) => line.status !== 'CANCELED' && line.required > 0);
}

function mapPackCardStatus(
  task: WmsFulfillmentQueueTask,
  fallback: string,
  tracking: string | null,
) {
  if (task.status === 'PACKED' && task.delivery?.label) {
    return task.delivery.label;
  }

  if (!tracking && task.status !== 'PACKED') {
    return 'No tracking';
  }

  if (task.status === 'PICKED') {
    return 'Awaiting pack';
  }

  if (task.status === 'PACKING') {
    return 'Packing';
  }

  if (task.status === 'PACKED') {
    return 'Packed';
  }

  return fallback;
}

function getStatusTone(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes('delivered')) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (normalized.includes('shipped')) {
    return 'bg-sky-50 text-sky-700';
  }

  if (normalized.includes('tracking')) {
    return 'bg-rose-50 text-rose-700';
  }

  if (normalized.includes('pack')) {
    return 'bg-violet-50 text-violet-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function formatOrderDate(value: string) {
  const trimmed = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toLocaleDateString('en-PH', {
    month: 'short',
    day: '2-digit',
  });
}
