import type {
  WmsMobileBasketPickPlan,
  WmsMobileBasketUnitScanDeltaResult,
  WmsMobilePickingTask,
} from '../types';

export function applyBasketScanDeltaToTask(
  task: WmsMobilePickingTask,
  result: WmsMobileBasketUnitScanDeltaResult,
): WmsMobilePickingTask {
  if (!result.taskId || task.id !== result.taskId || !result.counters.order) {
    return task;
  }

  const lineCounters = result.counters.line;
  const lines = result.lineId && lineCounters
    ? task.lines.map((line) => line.id === result.lineId
      ? {
          ...line,
          status: lineCounters.status,
          statusLabel: formatStatusLabel(lineCounters.status),
          required: lineCounters.required,
          allocated: lineCounters.allocated,
          picked: lineCounters.picked,
        }
      : line)
    : task.lines;
  const basket = task.basket
    ? {
        ...task.basket,
        status: result.basketStatus,
        statusLabel: formatStatusLabel(result.basketStatus),
        orders: task.basket.orders.map((order) => order.id === task.id
          ? {
              ...order,
              status: result.counters.order?.status ?? order.status,
              statusLabel: formatStatusLabel(result.counters.order?.status ?? order.status ?? ''),
              totals: {
                required: result.counters.order?.required ?? order.totals.required,
                picked: result.counters.order?.picked ?? order.totals.picked,
              },
            }
          : order),
      }
    : null;

  return {
    ...task,
    status: result.counters.order.status,
    statusLabel: formatStatusLabel(result.counters.order.status),
    totals: {
      ...task.totals,
      required: result.counters.order.required,
      allocated: result.counters.order.allocated,
      picked: result.counters.order.picked,
      remaining: result.counters.order.remaining,
    },
    basket,
    lines,
  };
}

export function applyBasketScanDeltaToPlan(
  plan: WmsMobileBasketPickPlan,
  result: WmsMobileBasketUnitScanDeltaResult,
): WmsMobileBasketPickPlan {
  if (plan.basketId !== result.basketId || !result.demandId || !result.counters.bin) {
    return plan;
  }

  const unitId = `${result.demandId}:${result.binId}`;
  const bins = plan.bins
    .map((group) => {
      if (group.bin.id !== result.binId) {
        return group;
      }

      const units = group.units
        .map((unit) => unit.id === unitId
          ? {
              ...unit,
              remainingUnits: Math.max(unit.remainingUnits - 1, 0),
              pickedUnits: Math.min(unit.pickedUnits + 1, unit.requiredUnits),
            }
          : unit)
        .filter((unit) => unit.remainingUnits > 0);
      const orders = group.orders
        .map((order) => order.id === result.taskId
          ? { ...order, pendingUnits: Math.max(order.pendingUnits - 1, 0) }
          : order)
        .filter((order) => order.pendingUnits > 0);

      return {
        ...group,
        pendingUnits: result.counters.bin?.remaining ?? group.pendingUnits,
        pickedUnits: result.counters.bin?.picked ?? group.pickedUnits,
        requiredUnits: result.counters.bin?.required ?? group.requiredUnits,
        orderCount: orders.length,
        orders,
        units,
      };
    })
    .filter((group) => group.pendingUnits > 0);

  return {
    ...plan,
    status: result.basketStatus,
    statusLabel: formatStatusLabel(result.basketStatus),
    totalPickedUnits: Math.min(plan.totalPickedUnits + 1, plan.totalRequiredUnits),
    totalPendingUnits: Math.max(plan.totalPendingUnits - 1, 0),
    totalPickedReservations: Math.min(plan.totalPickedReservations + 1, plan.totalRequiredUnits),
    currentBin: bins[0]?.bin ?? null,
    bins,
  };
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
