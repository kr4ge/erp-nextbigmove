'use client';

import type { WmsFulfillmentQueueTask } from '../_types/fulfillment';

type PackQueueEntry =
  | {
      key: string;
      kind: 'basket';
      basket: NonNullable<WmsFulfillmentQueueTask['basket']>;
      primaryTask: WmsFulfillmentQueueTask;
      tasks: WmsFulfillmentQueueTask[];
    }
  | {
      key: string;
      kind: 'task';
      basket: WmsFulfillmentQueueTask['basket'];
      primaryTask: WmsFulfillmentQueueTask;
      tasks: [WmsFulfillmentQueueTask];
    };

type FulfillmentPackQueueListProps = {
  activeBasketId: string | null;
  activeTaskId: string | null;
  tasks: WmsFulfillmentQueueTask[];
  isLoading: boolean;
  tenantReady: boolean;
  onSelectTask: (taskId: string) => void;
};

export function FulfillmentPackQueueList({
  activeBasketId,
  activeTaskId,
  tasks,
  isLoading,
  tenantReady,
  onSelectTask,
}: FulfillmentPackQueueListProps) {
  const entries = buildPackQueueEntries(tasks);

  if (!tenantReady) {
    return <div className="p-3">
      <EmptyState copy="Select a tenant or store scope to load the pack queue." />
    </div>
  }

  if (isLoading) {
    return <div className="p-3">
      <EmptyState copy="Loading pack queue..." />
    </div>
  }

  if (entries.length === 0) {
    return <div className="p-3">
      <EmptyState copy="No pack orders are in this view yet." />
    </div>
  }

  return (
    <div className="space-y-3 p-3">
      {entries.map((entry) => {
        const active = isPackQueueEntryActive(entry, activeTaskId, activeBasketId);

        if (entry.kind === 'basket') {
          return (
            <PackBasketQueueCard
              key={entry.key}
              active={active}
              entry={entry}
              onPress={() => onSelectTask(entry.primaryTask.id)}
            />
          );
        }

        return (
          <PackOrderQueueCard
            key={entry.key}
            active={active}
            task={entry.primaryTask}
            onPress={() => onSelectTask(entry.primaryTask.id)}
          />
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

function PackOrderQueueCard({
  active,
  task,
  onPress,
}: {
  active: boolean;
  task: WmsFulfillmentQueueTask;
  onPress: () => void;
}) {
  const tracking = task.tracking?.trim() || null;
  const summary = getVisiblePackLines(task.lines)
    .slice(0, 2)
    .map((line) => `${line.required}x ${line.productName}`)
    .join(' • ');
  const statusLabel = mapPackCardStatus(task, task.basket?.statusLabel ?? task.statusLabel, tracking);

  return (
    <button
      type="button"
      onClick={onPress}
      className={`card w-full text-left transition ${
        active
          ? 'border-[#12384b] bg-[#f7fafb] shadow-[0_24px_50px_-40px_rgba(18,56,75,0.4)]'
          : 'border-[#dce4ea] bg-white hover:border-[#c8d6df] hover:bg-[#fbfcfd]'
      }`}
    >
      <div className="flex justify-between gap-3">
        <p className="mt-1 truncate text-sm-custom 2xl:text-base font-semibold text-[#12384b]">
          {task.store?.name ?? 'Store'} &middot; #{task.posOrderId}
        </p>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(statusLabel)}`}>
          {statusLabel}
        </span>
      </div>

      <p className="mt-1 truncate text-xs text-[#6b7d89]">
        {tracking ? `Tracking ${tracking}` : 'Awaiting tracking print'}
      </p>

      <p className="mt-3 line-clamp-2 text-[13px] text-[#12384b]">
        {summary || `${task.totals.required} required unit${task.totals.required === 1 ? '' : 's'}`}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#718592]">
        <span>
          {formatPackQueueDate(getPackQueueDateValue(task))} &middot; 
          {` ${task.totals.packed}/${task.totals.required}`} &middot; 
          {` ${task.basket?.barcode ?? 'None'}`}
        </span>
      </div>
    </button>
  );
}

function PackBasketQueueCard({
  active,
  entry,
  onPress,
}: {
  active: boolean;
  entry: Extract<PackQueueEntry, { kind: 'basket' }>;
  onPress: () => void;
}) {
  const totalRequired = entry.tasks.reduce((sum, task) => sum + task.totals.required, 0);
  const totalPacked = entry.tasks.reduce((sum, task) => sum + task.totals.packed, 0);
  const statusLabel = mapPackBasketStatus(entry.tasks);

  return (
    <button
      type="button"
      onClick={onPress}
      className={`card w-full text-left transition ${
        active
          ? 'border-[#12384b] bg-[#f7fafb] shadow-[0_24px_50px_-40px_rgba(18,56,75,0.4)]'
          : 'border-[#dce4ea] bg-white hover:border-[#c8d6df] hover:bg-[#fbfcfd]'
      }`}
    >
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="mt-1 truncate text-sm-custom 2xl:text-base font-semibold text-[#12384b]">
            Basket {entry.basket.barcode}
          </p>
          <p className="mt-1 truncate text-xs text-[#6b7d89]">
            {formatPackBasketStoreLabel(entry.tasks)} &middot; {formatPackTrackingLabel(entry.tasks)}
          </p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(statusLabel)}`}>
          {statusLabel}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] text-[#12384b]">
        {formatPackUnitSummary(totalPacked, totalRequired)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#718592]">
        <span>
          {formatPackQueueDate(getPackQueueDateValue(entry.primaryTask))} &middot; 
          {` ${formatPackSlotSummary(entry.basket)}`}
        </span>
      </div>
    </button>
  );
}

function buildPackQueueEntries(tasks: WmsFulfillmentQueueTask[]): PackQueueEntry[] {
  const entries: PackQueueEntry[] = [];
  const seenBaskets = new Set<string>();

  for (const task of tasks) {
    const basket = task.basket;
    if (!basket?.orders?.length || task.status === 'PACKED') {
      entries.push({
        key: `task:${task.id}`,
        kind: 'task',
        basket,
        primaryTask: task,
        tasks: [task],
      });
      continue;
    }

    if (seenBaskets.has(basket.id)) {
      continue;
    }

    seenBaskets.add(basket.id);
    const basketTasks = tasks.filter((candidate) => candidate.basket?.id === basket.id);
    entries.push({
      key: `basket:${basket.id}`,
      kind: 'basket',
      basket,
      primaryTask: pickPrimaryPackTask(basketTasks),
      tasks: basketTasks,
    });
  }

  return entries;
}

function isPackQueueEntryActive(entry: PackQueueEntry, activeTaskId: string | null, activeBasketId: string | null) {
  if (activeBasketId && entry.basket?.id === activeBasketId) {
    return true;
  }

  if (!activeTaskId) {
    return false;
  }

  return entry.tasks.some((task) => task.id === activeTaskId);
}

function pickPrimaryPackTask(tasks: WmsFulfillmentQueueTask[]) {
  return [...tasks].sort((left, right) => {
    const rankDelta = getPackTaskPriority(left) - getPackTaskPriority(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    const rightTime = parseQueueDate(getPackQueueDateValue(right))?.getTime() ?? 0;
    const leftTime = parseQueueDate(getPackQueueDateValue(left))?.getTime() ?? 0;
    return rightTime - leftTime;
  })[0] ?? tasks[0];
}

function getPackTaskPriority(task: WmsFulfillmentQueueTask) {
  if (task.status === 'PACKING') {
    return 0;
  }

  if (!task.tracking?.trim() && task.status !== 'PACKED') {
    return 1;
  }

  if (task.status === 'PICKED') {
    return 2;
  }

  return 3;
}

function formatPackBasketStoreLabel(tasks: WmsFulfillmentQueueTask[]) {
  const uniqueStores = Array.from(new Set(
    tasks.map((task) => task.store?.name).filter((value): value is string => Boolean(value)),
  ));

  if (uniqueStores.length === 0) {
    return 'Assigned basket';
  }

  if (uniqueStores.length === 1) {
    return uniqueStores[0];
  }

  return `${uniqueStores.length} stores`;
}

function formatPackTrackingLabel(tasks: WmsFulfillmentQueueTask[]) {
  const missingTrackingCount = tasks.filter((task) => !task.tracking?.trim()).length;
  const readyTrackingCount = tasks.length - missingTrackingCount;

  if (missingTrackingCount > 0 && readyTrackingCount > 0) {
    return `${readyTrackingCount} with tracking · ${missingTrackingCount} waiting`;
  }

  if (missingTrackingCount > 0) {
    return `${missingTrackingCount} order${missingTrackingCount === 1 ? '' : 's'} waiting for tracking`;
  }

  return `${readyTrackingCount} order${readyTrackingCount === 1 ? '' : 's'} with tracking`;
}

function formatPackUnitSummary(totalPacked: number, totalRequired: number) {
  return `${totalPacked}/${totalRequired} units packed`;
}

function formatPackSlotSummary(
  basket: NonNullable<WmsFulfillmentQueueTask['basket']>,
) {
  const openSlots = Math.max(basket.maxFulfillmentOrders - basket.activeFulfillmentOrders, 0);
  if (openSlots === 0) {
    return `${basket.activeFulfillmentOrders} orders in basket · full`;
  }

  return `${basket.activeFulfillmentOrders} orders in basket · ${openSlots} slot${openSlots === 1 ? '' : 's'} open`;
}

function mapPackBasketStatus(tasks: WmsFulfillmentQueueTask[]) {
  if (tasks.some((task) => task.status === 'PACKING')) {
    return 'Packing';
  }

  if (tasks.some((task) => !task.tracking?.trim() && task.status !== 'PACKED')) {
    return 'No tracking';
  }

  if (tasks.every((task) => task.status === 'PACKED')) {
    return 'Packed';
  }

  return 'Awaiting pack';
}

function getPackQueueDateValue(task: WmsFulfillmentQueueTask) {
  return task.basket?.readyForPackAt
    ?? task.basket?.fullAt
    ?? task.completedAt
    ?? task.claimedAt
    ?? task.orderDateLocal
    ?? task.orderDate
    ?? task.createdAt;
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

function formatPackQueueDate(value: string) {
  const parsed = parseQueueDate(value);
  if (!parsed) {
    return value.trim();
  }

  return parsed.toLocaleDateString('en-PH', {
    month: 'short',
    day: '2-digit',
  });
}

function parseQueueDate(value: string) {
  const trimmed = value.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
