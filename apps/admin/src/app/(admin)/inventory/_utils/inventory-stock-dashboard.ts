import type {
  WmsInventoryOverviewResponse,
  WmsInventoryUnitStatus,
} from '../_types/inventory';

export type StockHeadlineMetric = {
  id: 'units' | 'dispatch' | 'capacity';
  label: string;
  value: string;
};

export type StaticMilestone = {
  id: string;
  label: string;
  value: string;
  trend: string;
  direction: 'up' | 'down';
  points: number[];
};

export type StockDashboardView = {
  headline: StockHeadlineMetric[];
  milestones: StaticMilestone[];
};

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

function formatCount(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function getStatusCount(
  overview: WmsInventoryOverviewResponse | null,
  status: WmsInventoryUnitStatus,
) {
  return overview?.filters.statuses.find((entry) => entry.value === status)?.unitCount ?? 0;
}

export function buildInventoryStockDashboard(
  overview: WmsInventoryOverviewResponse | null,
): StockDashboardView {
  const unitsOnHand = overview?.summary.unitsOnHand ?? overview?.summary.skuOnHand ?? 0;
  const dispatchedUnits = overview?.summary.dispatchedUnits ?? getStatusCount(overview, 'DISPATCHED');
  const capacity = overview?.summary.warehouseCapacity ?? {
    usedUnits: 0,
    totalUnits: 0,
    utilizationPercent: 0,
  };

  return {
    headline: [
      {
        id: 'units',
        label: 'Units on Hand',
        value: formatCount(unitsOnHand),
      },
      {
        id: 'dispatch',
        label: 'Dispatch Units',
        value: formatCount(dispatchedUnits),
      },
      {
        id: 'capacity',
        label: 'Warehouse Capacity',
        value: `${capacity.utilizationPercent}%`,
      },
    ],
    milestones: [
      {
        id: 'perfect-putaway',
        label: 'Perfect Putaway Rate',
        value: '82%',
        trend: '40.0%',
        direction: 'up',
        points: [16, 21, 18, 26, 22, 34, 31, 46, 39, 58, 52, 72],
      },
      {
        id: 'return-rate',
        label: 'Order Return Rate',
        value: '12%',
        trend: '30.0%',
        direction: 'down',
        points: [44, 33, 41, 35, 52, 49, 38, 46, 42, 59, 54, 47],
      },
    ],
  };
}
