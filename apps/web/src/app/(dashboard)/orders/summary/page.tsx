'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { AnalyticsMultiSelectPicker } from '../../analytics/_components/analytics-multi-select-picker';
import { AnalyticsSortToggleLabel } from '../../analytics/_components/analytics-sort-toggle-label';
import { AgingOrdersTable } from '../_components/aging-orders-table';
import { useAgingOrdersSummary } from '../_hooks/use-aging-orders-summary';
import { useOrdersPermissions } from '../_hooks/use-orders-permissions';

export default function OrdersSummaryPage() {
  const router = useRouter();
  const { isLoading, canViewOrdersSummary, canViewOrderConfirmation } = useOrdersPermissions();
  const agingSummary = useAgingOrdersSummary(!isLoading && canViewOrdersSummary);

  useEffect(() => {
    if (isLoading || canViewOrdersSummary) return;
    router.replace(canViewOrderConfirmation ? '/orders/confirmation' : '/dashboard');
  }, [canViewOrderConfirmation, canViewOrdersSummary, isLoading, router]);

  if (isLoading || !canViewOrdersSummary) {
    return <LoadingCard label="Loading orders summary..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs="Orders"
        title="Orders Summary"
        description={`Orders with no status change for the last ${agingSummary.thresholdDays} days.`}
      />

      {agingSummary.error ? (
        <AlertBanner tone="error" message={agingSummary.error} />
      ) : null}

      {agingSummary.shopPickerOptions.length === 0 && !agingSummary.isLoading ? (
        <p className="flex h-10 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
          No shops to filter.
        </p>
      ) : (
        <AnalyticsMultiSelectPicker
          className="relative"
          selectedLabel={agingSummary.selectedShopLabel}
          selectTitle="Select shops"
          options={agingSummary.shopPickerOptions}
          allChecked={agingSummary.isAllShopsMode}
          isChecked={(value) => agingSummary.resolvedShopIds.includes(value)}
          onToggleAll={agingSummary.setAllShopsMode}
          onToggle={agingSummary.toggleShop}
          onOnly={agingSummary.setOnlyShop}
          onClear={agingSummary.clearShopFilter}
        />
      )}

      <AgingOrdersTable
        isLoading={agingSummary.isLoading}
        start={agingSummary.start}
        end={agingSummary.end}
        total={agingSummary.totalRows}
        onPrevious={agingSummary.onPrevious}
        onNext={agingSummary.onNext}
        canPrevious={agingSummary.canPrevious}
        canNext={agingSummary.canNext}
        pageSize={agingSummary.pageSize}
        page={agingSummary.page}
        totalPages={agingSummary.totalPages}
        rows={agingSummary.rows}
        sourceCount={agingSummary.sourceCount}
        hasShopUnread={agingSummary.hasShopUnread}
        markingShopId={agingSummary.markingShopId}
        onShopRead={agingSummary.markShopRead}
        renderSortLabel={(label, key) => (
          <AnalyticsSortToggleLabel
            label={String(label)}
            isActive={agingSummary.sortKey === key}
            direction={agingSummary.sortDir}
            onToggle={() => agingSummary.handleSort(key)}
          />
        )}
      />
    </div>
  );
}
