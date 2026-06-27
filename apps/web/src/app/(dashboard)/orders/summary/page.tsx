'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { AnalyticsMultiSelectPicker } from '../../analytics/_components/analytics-multi-select-picker';
import { AnalyticsSortToggleLabel } from '../../analytics/_components/analytics-sort-toggle-label';
import {
  formatDateInTimezone,
  normalizeDatepickerValue,
  parseYmdToLocalDate,
} from '../../analytics/_utils/date';
import { AgingOrdersTable } from '../_components/aging-orders-table';
import { OrderStatusSummaryTable } from '../_components/order-status-summary-table';
import { useAgingOrdersSummary } from '../_hooks/use-aging-orders-summary';
import { useOrderStatusSummary } from '../_hooks/use-order-status-summary';
import { useOrdersPermissions } from '../_hooks/use-orders-permissions';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

export default function OrdersSummaryPage() {
  const router = useRouter();
  const { isLoading, canViewOrdersSummary, canViewOrderConfirmation } = useOrdersPermissions();
  const agingSummary = useAgingOrdersSummary(!isLoading && canViewOrdersSummary);
  const [activeTab, setActiveTab] = useState<'summary' | 'aging'>('summary');
  const today = useMemo(() => formatDateInTimezone(new Date()), []);
  const [summaryDate, setSummaryDate] = useState(today);
  const orderStatusSummary = useOrderStatusSummary(summaryDate, !isLoading && canViewOrdersSummary);
  const [summaryDateRange, setSummaryDateRange] = useState(() => ({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  }));

  const activeGeneratedAt =
    activeTab === 'summary' ? orderStatusSummary.generatedAt : agingSummary.generatedAt;

  const activeIsLoading =
    activeTab === 'summary' ? orderStatusSummary.isLoading : agingSummary.isLoading;

  const activeReload = activeTab === 'summary'
    ? orderStatusSummary.reload
    : agingSummary.reload;

  const generatedAtLabel = useMemo(() => {
    if (!activeGeneratedAt) {
      return 'Not generated yet';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(activeGeneratedAt));
  }, [activeGeneratedAt]);

  useEffect(() => {
    if (isLoading || canViewOrdersSummary) return;
    router.replace(canViewOrderConfirmation ? '/orders/confirmation' : '/dashboard');
  }, [canViewOrderConfirmation, canViewOrdersSummary, isLoading, router]);

  const summaryDateIsToday = summaryDate === today;
  const summaryDateButtonLabel = useMemo(() => {
    const parsed = parseYmdToLocalDate(summaryDate);
    return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }).format(parsed);
  }, [summaryDate]);

  if (isLoading || !canViewOrdersSummary) {
    return <LoadingCard label="Loading orders summary..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs="Orders"
        title="Orders Summary"
        description={
          activeTab === 'summary'
            ? 'Live order volume by store and status.'
            : `Orders with no status change for the last ${agingSummary.thresholdDays} days.`
        }
        actions={(
          <button
            type="button"
            onClick={() => {
              void activeReload();
            }}
            disabled={activeIsLoading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-surface dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${activeIsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-6 border-b border-slate-200 dark:border-border">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  activeTab === 'summary'
                    ? 'border-primary text-orange-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                Summary
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('aging')}
                className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  activeTab === 'aging'
                    ? 'border-primary text-orange-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                Aging
              </button>
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 lg:ml-auto">
            {activeTab === 'summary' ? (
              <div className="relative shrink-0">
                <Datepicker
                  value={summaryDateRange}
                  onChange={(value) => {
                    const nextYmd = normalizeDatepickerValue(value?.startDate || value?.endDate, today);
                    setSummaryDate(nextYmd);
                    setSummaryDateRange({
                      startDate: parseYmdToLocalDate(nextYmd),
                      endDate: parseYmdToLocalDate(nextYmd),
                    });
                  }}
                  useRange={false}
                  asSingle={false}
                  showShortcuts={false}
                  showFooter={false}
                  primaryColor="orange"
                  readOnly
                  inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-border dark:!bg-transparent dark:!text-transparent transition-[width] duration-300 ease-out ${
                    summaryDateIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
                  }`}
                  containerClassName="relative z-50"
                  popupClassName={(defaultClass: string) => `${defaultClass} z-[70] kpi-datepicker-light`}
                  displayFormat="MM/DD/YYYY"
                  separator=" – "
                  toggleIcon={() => (
                    <span className="flex w-full items-center gap-2 overflow-hidden">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span
                        className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out dark:text-foreground ${
                          summaryDateIsToday
                            ? 'max-w-0 -translate-x-1 opacity-0'
                            : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                        }`}
                      >
                        {summaryDateButtonLabel}
                      </span>
                    </span>
                  )}
                  toggleClassName="absolute inset-0 flex cursor-pointer items-center justify-start rounded-xl border border-slate-200 px-3 text-slate-600 hover:text-orange-700 dark:border-border dark:text-foreground"
                  placeholder=" "
                />
              </div>
            ) : null}

            <div className="min-w-0 lg:w-[18rem]">
              {(activeTab === 'summary' ? orderStatusSummary.shopPickerOptions.length === 0 && !orderStatusSummary.isLoading : agingSummary.shopPickerOptions.length === 0 && !agingSummary.isLoading) ? (
                <p className="flex h-10 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                  No shops to filter.
                </p>
              ) : (
                <AnalyticsMultiSelectPicker
                  className="relative"
                  selectedLabel={activeTab === 'summary' ? orderStatusSummary.selectedShopLabel : agingSummary.selectedShopLabel}
                  selectTitle="Select shops"
                  options={activeTab === 'summary' ? orderStatusSummary.shopPickerOptions : agingSummary.shopPickerOptions}
                  allChecked={activeTab === 'summary' ? orderStatusSummary.isAllShopsMode : agingSummary.isAllShopsMode}
                  isChecked={(value) => activeTab === 'summary'
                    ? orderStatusSummary.resolvedShopIds.includes(value)
                    : agingSummary.resolvedShopIds.includes(value)}
                  onToggleAll={activeTab === 'summary' ? orderStatusSummary.setAllShopsMode : agingSummary.setAllShopsMode}
                  onToggle={activeTab === 'summary' ? orderStatusSummary.toggleShop : agingSummary.toggleShop}
                  onOnly={activeTab === 'summary' ? orderStatusSummary.setOnlyShop : agingSummary.setOnlyShop}
                  onClear={activeTab === 'summary' ? orderStatusSummary.clearShopFilter : agingSummary.clearShopFilter}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
          <span>
            {activeTab === 'summary'
              ? `Summary date: ${summaryDateButtonLabel}`
              : `Threshold: ${agingSummary.thresholdDays} days`}
          </span>
          <span>{`Generated: ${generatedAtLabel}`}</span>
        </div>
      </div>

      {(activeTab === 'summary' ? orderStatusSummary.error : agingSummary.error) ? (
        <AlertBanner tone="error" message={activeTab === 'summary' ? orderStatusSummary.error : agingSummary.error} />
      ) : null}

      {activeTab === 'summary' ? (
        <OrderStatusSummaryTable
          rows={orderStatusSummary.rows}
          start={orderStatusSummary.start}
          end={orderStatusSummary.end}
          total={orderStatusSummary.totalRows}
          page={orderStatusSummary.page}
          totalPages={orderStatusSummary.totalPages}
          canPrevious={orderStatusSummary.canPrevious}
          canNext={orderStatusSummary.canNext}
          onPrevious={orderStatusSummary.onPrevious}
          onNext={orderStatusSummary.onNext}
          renderSortLabel={(label, key) => (
            <AnalyticsSortToggleLabel
              label={String(label)}
              isActive={orderStatusSummary.sortKey === key}
              direction={orderStatusSummary.sortDir}
              onToggle={() => orderStatusSummary.handleSort(key as never)}
            />
          )}
        />
      ) : (
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
      )}
    </div>
  );
}
