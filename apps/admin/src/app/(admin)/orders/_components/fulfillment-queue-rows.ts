import type {
  WmsFulfillmentHeldBasket,
  WmsFulfillmentQueueMode,
  WmsFulfillmentQueueTask,
} from '../_types/fulfillment';

export type WmsFulfillmentBasketRow = {
  kind: 'basket';
  key: string;
  basket: NonNullable<WmsFulfillmentQueueTask['basket']>;
  tasks: WmsFulfillmentQueueTask[];
  totals: {
    required: number;
    picked: number;
    remaining: number;
  };
  orderDate: string;
  orderDateLocal: string | null;
};

export type WmsFulfillmentTaskRow = {
  kind: 'task';
  key: string;
  task: WmsFulfillmentQueueTask;
};

export type WmsFulfillmentQueueRow = WmsFulfillmentBasketRow | WmsFulfillmentTaskRow;

export function buildFulfillmentQueueRows(
  _mode: WmsFulfillmentQueueMode,
  tasks: WmsFulfillmentQueueTask[],
): WmsFulfillmentQueueRow[] {
  return tasks.map((task) => ({
    kind: 'task' as const,
    key: task.id,
    task,
  }));
}

export function buildFulfillmentBasketRows(tasks: WmsFulfillmentQueueTask[]): WmsFulfillmentBasketRow[] {
  const groupedTasks = new Map<string, WmsFulfillmentQueueTask[]>();

  for (const task of tasks) {
    if (!task.basket?.id) {
      continue;
    }

    const existing = groupedTasks.get(task.basket.id) ?? [];
    existing.push(task);
    groupedTasks.set(task.basket.id, existing);
  }

  const rows: WmsFulfillmentBasketRow[] = [];

  for (const task of tasks) {
    if (!task.basket?.id || groupedTasks.get(task.basket.id) === undefined) {
      continue;
    }

    const basketTasks = groupedTasks.get(task.basket.id);
    if (!basketTasks) {
      continue;
    }

    groupedTasks.delete(task.basket.id);
    const basketOrders = task.basket.orders.length > 0
      ? task.basket.orders
      : basketTasks.map((basketTask) => ({
        id: basketTask.id,
        posOrderId: basketTask.posOrderId,
        tracking: null,
        status: basketTask.status,
        statusLabel: basketTask.statusLabel,
        customerName: basketTask.customer.name,
        totals: {
          required: basketTask.totals.required,
          picked: basketTask.totals.picked,
        },
        store: basketTask.store,
      }));
    const required = basketOrders.reduce((sum, order) => sum + (order.totals.required ?? 0), 0);
    const picked = basketOrders.reduce((sum, order) => sum + (order.totals.picked ?? 0), 0);
    const orderedTasks = [...basketTasks].sort((left, right) => {
      const leftDate = left.orderDateLocal ?? left.orderDate;
      const rightDate = right.orderDateLocal ?? right.orderDate;
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }

      return left.id.localeCompare(right.id);
    });

    rows.push({
      kind: 'basket',
      key: `basket:${task.basket.id}`,
      basket: task.basket,
      tasks: orderedTasks,
      totals: {
        required,
        picked,
        remaining: Math.max(required - picked, 0),
      },
      orderDate: orderedTasks[0]?.orderDate ?? task.orderDate,
      orderDateLocal: orderedTasks[0]?.orderDateLocal ?? task.orderDateLocal,
    });
  }

  return rows;
}

export function buildHeldBasketRows(heldBaskets: WmsFulfillmentHeldBasket[]): WmsFulfillmentBasketRow[] {
  return heldBaskets.map((basket) => {
    const orderedTasks = [...basket.tasks].sort((left, right) => {
      const leftDate = left.orderDateLocal ?? left.orderDate;
      const rightDate = right.orderDateLocal ?? right.orderDate;
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }

      return left.id.localeCompare(right.id);
    });
    const basketOrders = basket.orders.length > 0
      ? basket.orders
      : orderedTasks.map((task) => ({
        id: task.id,
        posOrderId: task.posOrderId,
        tracking: task.tracking,
        status: task.status,
        statusLabel: task.statusLabel,
        customerName: task.customer.name,
        totals: {
          required: task.totals.required,
          picked: task.totals.picked,
        },
        store: task.store,
      }));
    const required = basketOrders.reduce((sum, order) => sum + (order.totals.required ?? 0), 0);
    const picked = basketOrders.reduce((sum, order) => sum + (order.totals.picked ?? 0), 0);

    return {
      kind: 'basket',
      key: `held-basket:${basket.id}`,
      basket,
      tasks: orderedTasks,
      totals: {
        required,
        picked,
        remaining: Math.max(required - picked, 0),
      },
      orderDate: orderedTasks[0]?.orderDate ?? basket.claimedAt ?? basket.fullAt ?? basket.readyForPackAt ?? '',
      orderDateLocal: orderedTasks[0]?.orderDateLocal ?? null,
    };
  });
}
