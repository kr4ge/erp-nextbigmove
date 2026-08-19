import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import type {
  WmsMobileBasketPackPlan,
  WmsMobilePackingUnitScanDelta,
} from '../types';

export function applyPackingScanDeltaToPlan(
  plan: WmsMobileBasketPackPlan,
  result: WmsMobilePackingUnitScanDelta,
): WmsMobileBasketPackPlan {
  if (plan.basketId !== result.basketId) {
    return plan;
  }

  const orders = plan.orders.map((order) => {
    if (order.id !== result.orderId) {
      return order;
    }

    return {
      ...order,
      status: result.counters.order.status,
      statusLabel: formatStatusLabel(result.counters.order.status),
      totals: {
        required: result.counters.order.required,
        packed: result.counters.order.packed,
        remaining: result.counters.order.remaining,
      },
      lines: order.lines.map((line) => line.id === result.lineId
        ? {
            ...line,
            required: result.counters.line.required,
            packed: result.counters.line.packed,
            remaining: result.counters.line.remaining,
            availableInBasket: result.counters.availableVariationUnits,
          }
        : line),
    };
  });
  const activeOrder = orders.find((order) => order.id === result.activeOrderId) ?? null;
  const availableUnits = plan.availableUnits
    .map((unit) => unit.variationId === result.packedUnit.variationId
      ? { ...unit, unitCount: result.counters.availableVariationUnits }
      : unit)
    .filter((unit) => unit.unitCount > 0);

  return {
    ...plan,
    status: result.basketStatus,
    statusLabel: formatStatusLabel(result.basketStatus),
    totals: result.counters.basket,
    availableUnits,
    orders,
    activeOrder,
  };
}

export function applyPackingScanDeltaToTask(
  task: WmsMobilePickingTask,
  result: WmsMobilePackingUnitScanDelta,
): WmsMobilePickingTask {
  if (task.id !== result.orderId) {
    return task;
  }

  return {
    ...task,
    status: result.counters.order.status as WmsMobilePickingTask['status'],
    statusLabel: formatStatusLabel(result.counters.order.status),
    totals: {
      ...task.totals,
      required: result.counters.order.required,
      packed: result.counters.order.packed,
    },
    basket: task.basket
      ? {
          ...task.basket,
          status: result.basketStatus,
          statusLabel: formatStatusLabel(result.basketStatus),
        }
      : task.basket,
    lines: task.lines.map((line) => line.id === result.lineId
      ? {
          ...line,
          packed: result.counters.line.packed,
        }
      : line),
  };
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
