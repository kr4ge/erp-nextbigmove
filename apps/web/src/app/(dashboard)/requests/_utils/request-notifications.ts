import type { WmsPurchasingBatchStatus, WmsPurchasingOverviewResponse } from '../_types/request';

const ERP_ACTIONABLE_STATUSES: WmsPurchasingBatchStatus[] = [
  'REVISION',
  'PENDING_PAYMENT',
  'AWAITING_PRODUCTS',
  'RECEIVING_EXCEPTION',
];

export function getErpRequestNotificationCount(overview: WmsPurchasingOverviewResponse | null | undefined) {
  if (!overview?.tenantReady) {
    return 0;
  }

  const counts = new Map(overview.filters.statuses.map((item) => [item.value, item.batchCount]));

  return ERP_ACTIONABLE_STATUSES.reduce(
    (total, status) => total + (counts.get(status) ?? 0),
    0,
  );
}
