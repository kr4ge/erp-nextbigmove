'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertBanner, LoadingCard } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { useAnalyticsDateRange } from '../analytics/_hooks/use-analytics-date-range';
import { ReportsSummaryTable } from './_components/reports-summary-table';
import { fetchPosOrdersReport } from './_services/reports-api';
import type { PosOrdersReportResponse } from './_types/reports';
import {
  exportPosOrdersReportCsv,
  exportPosOrdersReportXlsx,
} from './_utils/reports-export';
import { buildPosOrdersReportTotals } from './_utils/reports-format';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

export default function ReportsPage() {
  const { addToast } = useToast();
  const { today, range, startDate, endDate, handleDateRangeChange, syncDateRangeFromApi } =
    useAnalyticsDateRange();
  const [report, setReport] = useState<PosOrdersReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseErrorMessage = (value: unknown) => {
    if (!value || typeof value !== 'object') return 'Failed to load POS orders report.';
    const maybeError = value as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };

    const responseMessage = maybeError.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
    }
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }
    return 'Failed to load POS orders report.';
  };

  const fetchReport = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('start_date', startDate);
        params.set('end_date', endDate);
        const nextReport = await fetchPosOrdersReport(params);
        setReport(nextReport);
        syncDateRangeFromApi(nextReport.selected.start_date, nextReport.selected.end_date);
      } catch (fetchError: unknown) {
        setError(parseErrorMessage(fetchError));
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [endDate, startDate, syncDateRangeFromApi],
  );

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const hasRows = (report?.items.length || 0) > 0;
  const totals = useMemo(
    () => (report ? buildPosOrdersReportTotals(report.items) : null),
    [report],
  );
  const generatedAtLabel = useMemo(() => {
    if (!report?.generated_at) return '—';
    return new Date(report.generated_at).toLocaleString();
  }, [report?.generated_at]);

  const reportsDateRangeIsToday = startDate === today && endDate === today;
  const formatDateRangeButtonDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  };
  const reportsDateRangeButtonLabel =
    startDate === endDate
      ? formatDateRangeButtonDate(startDate)
      : `${formatDateRangeButtonDate(startDate)} - ${formatDateRangeButtonDate(endDate)}`;

  const handleExportCsv = async () => {
    if (!report || report.items.length === 0) return;
    setIsExportingCsv(true);
    try {
      exportPosOrdersReportCsv(report);
      addToast('success', 'CSV export generated.');
    } catch {
      addToast('error', 'Failed to export CSV report.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportXlsx = async () => {
    if (!report || report.items.length === 0) return;
    setIsExportingXlsx(true);
    try {
      await exportPosOrdersReportXlsx(report);
      addToast('success', 'XLSX export generated.');
    } catch {
      addToast('error', 'Failed to export XLSX report.');
    } finally {
      setIsExportingXlsx(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={
          <span className='text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary'>
            Reports
          </span>
        }
        title="Reports"
        description="Tenant-wide POS order exports grouped by store. Stores with zero orders in the selected range are excluded."
        actions={(
          <>
            <Button
              variant="outline"
              iconLeft={<Download className="h-4 w-4" />}
              onClick={handleExportCsv}
              disabled={!hasRows || isLoading}
              loading={isExportingCsv}
            >
              Export CSV
            </Button>
            <Button
              iconLeft={<FileSpreadsheet className="h-4 w-4" />}
              onClick={handleExportXlsx}
              disabled={!hasRows || isLoading}
              loading={isExportingXlsx}
            >
              Export XLSX
            </Button>
          </>
        )}
      />

      
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <Datepicker
              value={range}
              onChange={handleDateRangeChange}
              useRange={false}
              asSingle={false}
              showShortcuts={false}
              showFooter={false}
              primaryColor="orange"
              readOnly
              inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-slate-200 dark:!bg-white dark:!text-transparent transition-[width] duration-300 ease-out ${
                reportsDateRangeIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
              }`}
              containerClassName=""
              popupClassName={(defaultClass) => `${defaultClass} z-50 kpi-datepicker-light`}
              displayFormat="MM/DD/YYYY"
              separator=" - "
              toggleIcon={() => (
                <span className="flex w-full items-center gap-2 overflow-hidden">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span
                    className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                      reportsDateRangeIsToday
                        ? 'max-w-0 -translate-x-1 opacity-0'
                        : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                    }`}
                  >
                    {reportsDateRangeButtonLabel}
                  </span>
                </span>
              )}
              toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
              placeholder=" "
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <div>
              Stores: <span className="font-semibold text-slate-900">{report?.row_count ?? 0}</span>
            </div>
            <div>
              Generated: <span className="font-semibold text-slate-900">{generatedAtLabel}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<RefreshCw className="h-4 w-4" />}
              onClick={() => void fetchReport()}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <AlertBanner
            tone="info"
            message="To get high-accuracy report data, fetch the POS data in /workflows first."
          />
        </div>
      

      {error && <AlertBanner tone="error" message={error} />}

      {isLoading ? (
        <LoadingCard label="Loading POS orders report..." />
      ) : report && report.items.length > 0 ? (
        <ReportsSummaryTable items={report.items} totals={totals!} />
      ) : (
        <Card className="border-dashed border-slate-300 bg-slate-50/60 text-center text-slate-600">
          No stores with orders were found for the selected date range.
        </Card>
      )}
    </div>
  );
}
