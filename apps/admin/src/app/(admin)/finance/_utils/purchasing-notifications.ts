import type { WmsPurchasingBatchStatus, WmsPurchasingOverviewResponse } from '../_types/purchasing';

const WMS_ACTIONABLE_STATUSES: WmsPurchasingBatchStatus[] = [
  'UNDER_REVIEW',
  'PAYMENT_REVIEW',
  'SHIPPED',
];

export function getWmsPurchasingNotificationCount(
  overview: WmsPurchasingOverviewResponse | null | undefined,
) {
  if (!overview?.tenantReady) {
    return 0;
  }

  const counts = new Map(overview.filters.statuses.map((item) => [item.value, item.batchCount]));

  return WMS_ACTIONABLE_STATUSES.reduce(
    (total, status) => total + (counts.get(status) ?? 0),
    0,
  );
}
