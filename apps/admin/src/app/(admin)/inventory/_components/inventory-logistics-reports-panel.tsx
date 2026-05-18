'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { normalizeBarcodeValue, renderCode128SvgMarkup } from '../../warehouses/_utils/code39-barcode';
import type { WmsInventoryUnitRecord } from '../_types/inventory';
import {
  formatInventoryStatusLabel,
  getInventoryStatusClassName,
} from '../_utils/inventory-status-presenters';

type LogisticsTab = 'outbound' | 'inbound' | 'reports';
type LogisticsDateSelection = {
  startDate: string;
  endDate: string;
};
type LogisticsDatePickerValue = {
  startDate: Date | null;
  endDate: Date | null;
};

type InventoryLogisticsReportsPanelProps = {
  units: WmsInventoryUnitRecord[];
};

const LOGISTICS_TABS: Array<{ value: LogisticsTab; label: string }> = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'reports', label: 'Reports' },
];

const OUTBOUND_STATUSES = new Set<WmsInventoryUnitRecord['status']>([
  'PICKED',
  'PACKED',
  'DISPATCHED',
]);

const INBOUND_STATUSES = new Set<WmsInventoryUnitRecord['status']>([
  'RECEIVED',
  'STAGED',
  'PUTAWAY',
]);

const REPORT_STATUSES = new Set<WmsInventoryUnitRecord['status']>([
  'RTS',
  'DAMAGED',
  'ARCHIVED',
]);
const LOGISTICS_PAGE_SIZE = 4;
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

export function InventoryLogisticsReportsPanel({
  units,
}: InventoryLogisticsReportsPanelProps) {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('inbound');
  const [dateRange, setDateRange] = useState<LogisticsDateSelection>(() => getTodayDateSelection());
  const [pageIndex, setPageIndex] = useState(0);
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const datePickerValue = useMemo<LogisticsDatePickerValue>(
    () => ({
      startDate: parseDateInputValue(dateRange.startDate),
      endDate: parseDateInputValue(dateRange.endDate),
    }),
    [dateRange.endDate, dateRange.startDate],
  );
  const filteredUnits = useMemo(
    () => buildLogisticsUnits(units, activeTab, dateRange),
    [units, activeTab, dateRange],
  );
  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / LOGISTICS_PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleUnits = filteredUnits.slice(
    safePageIndex * LOGISTICS_PAGE_SIZE,
    safePageIndex * LOGISTICS_PAGE_SIZE + LOGISTICS_PAGE_SIZE,
  );
  const hasCarousel = filteredUnits.length > LOGISTICS_PAGE_SIZE;
  const isTodayRange = dateRange.startDate === today && dateRange.endDate === today;
  const dateRangeButtonLabel = formatDateRangeButtonLabel(dateRange);

  useEffect(() => {
    setPageIndex(0);
  }, [activeTab, dateRange.startDate, dateRange.endDate, units]);

  const handleDateRangeChange = (value: {
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  } | null) => {
    setDateRange((current) => {
      const nextStart = normalizeDatepickerValue(value?.startDate, current.startDate || today);
      const nextEnd = normalizeDatepickerValue(value?.endDate, nextStart);

      return {
        startDate: nextStart,
        endDate: nextEnd < nextStart ? nextStart : nextEnd,
      };
    });
  };

  return (
    <section className="rounded-[20px] border border-[#dce4ea] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.1rem] font-semibold tracking-tight text-[#12384b]">Logistics Reports</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {LOGISTICS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  activeTab === tab.value
                    ? 'bg-[#12384b] text-white'
                    : 'bg-[#f4f7f9] text-[#6f8290] hover:bg-[#eaf0f4] hover:text-[#12384b]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative shrink-0">
            <Datepicker
              value={datePickerValue}
              onChange={handleDateRangeChange}
              useRange={false}
              asSingle={false}
              showShortcuts={false}
              showFooter={false}
              primaryColor="orange"
              readOnly
              inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm transition-[width] duration-300 ease-out focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-slate-200 dark:!bg-white dark:!text-transparent ${
                isTodayRange ? 'w-10' : 'w-[200px] sm:w-[236px]'
              }`}
              containerClassName=""
              popupClassName={(defaultClass) => `${defaultClass} z-50 kpi-datepicker-light`}
              displayFormat="MM/DD/YYYY"
              separator=" – "
              popoverDirection="down"
              toggleIcon={() => (
                <span className="flex w-full items-center gap-2 overflow-hidden">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span
                    className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                      isTodayRange
                        ? 'max-w-0 -translate-x-1 opacity-0'
                        : 'max-w-[148px] translate-x-0 opacity-100 sm:max-w-[184px]'
                    }`}
                  >
                    {dateRangeButtonLabel}
                  </span>
                </span>
              )}
              toggleClassName="absolute inset-0 flex cursor-pointer items-center justify-start px-3 text-slate-600 hover:text-orange-700"
              placeholder=" "
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        {hasCarousel ? (
          <button
            type="button"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={safePageIndex === 0}
            className="absolute left-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#d7e0e7] bg-white text-[#6f8290] shadow-sm transition hover:bg-[#f4f7f9] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous logistics units"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}

        <div className={`grid min-h-[286px] gap-3 md:grid-cols-2 ${hasCarousel ? 'px-6 md:px-8' : ''}`}>
          {visibleUnits.length > 0 ? (
            visibleUnits.map((unit) => (
              <LogisticsUnitCard key={unit.id} unit={unit} tab={activeTab} />
            ))
          ) : (
            <div className="col-span-full flex min-h-[220px] items-center justify-center rounded-[16px] border border-dashed border-[#dce4ea] bg-[#fbfcfd] px-4 text-center text-sm text-[#6f8290]">
              No units found for this date range.
            </div>
          )}
        </div>

        {hasCarousel ? (
          <button
            type="button"
            onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePageIndex >= totalPages - 1}
            className="absolute right-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-[#d7e0e7] bg-white text-[#6f8290] shadow-sm transition hover:bg-[#f4f7f9] hover:text-[#12384b] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next logistics units"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {hasCarousel ? (
        <div className="mt-4 flex items-center justify-center gap-2" aria-label="Logistics report pages">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setPageIndex(index)}
              className={`h-2.5 rounded-full transition ${
                index === safePageIndex
                  ? 'w-6 bg-[#12384b]'
                  : 'w-2.5 border border-[#cfd9e1] bg-[#dbe3ea] hover:bg-[#b9c7d2]'
              }`}
              aria-label={`Go to logistics page ${index + 1}`}
              aria-current={index === safePageIndex ? 'page' : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LogisticsUnitCard({
  unit,
  tab,
}: {
  unit: WmsInventoryUnitRecord;
  tab: LogisticsTab;
}) {
  const barcodeValue = normalizeBarcodeValue(unit.barcode);
  const barcodeMarkup = useMemo(() => {
    if (!barcodeValue) {
      return '';
    }

    return renderCode128SvgMarkup(barcodeValue, {
      height: 42,
      moduleWidth: 1,
      quietZone: 10,
      showText: false,
      barColor: '#12384b',
    });
  }, [barcodeValue]);
  const reportTone = getLogisticsReportTone(unit, tab);

  return (
    <article className="rounded-[16px] border border-[#dce4ea] bg-white px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${getInventoryStatusClassName(unit.status)}`}
        >
          {formatInventoryStatusLabel(unit.status)}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${reportTone.className}`}
        >
          <span className={`h-2 w-2 rounded-full ${reportTone.dotClassName}`} />
          {reportTone.label}
        </span>
      </div>

      <p className="mt-3 truncate text-sm font-semibold text-[#12384b]">{unit.code}</p>
      <p className="mt-0.5 truncate text-[12px] font-medium text-[#5f7483]">{unit.name}</p>

      <div className="mt-3 flex min-w-0 justify-center">
        <div
          className="inline-flex max-w-full items-center overflow-hidden rounded-[10px] border border-[#e7edf2] bg-white px-1.5 py-1.5 [&_svg]:h-[42px] [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: barcodeMarkup }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-medium text-[#7b8e9c]">
        <span className="min-w-0 truncate">{barcodeValue}</span>
        <span className="shrink-0">{unit.currentLocation?.label ?? unit.currentLocation?.code ?? 'No location'}</span>
      </div>
    </article>
  );
}

function buildLogisticsUnits(
  units: WmsInventoryUnitRecord[],
  tab: LogisticsTab,
  dateRange: LogisticsDateSelection,
) {
  const { from, to } = getLogisticsDateWindow(dateRange);

  return units
    .filter((unit) => isUnitInLogisticsTab(unit, tab))
    .filter((unit) => {
      const updatedAt = new Date(unit.updatedAt).getTime();

      return updatedAt >= from.getTime() && updatedAt < to.getTime();
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function isUnitInLogisticsTab(unit: WmsInventoryUnitRecord, tab: LogisticsTab) {
  if (tab === 'outbound') {
    return OUTBOUND_STATUSES.has(unit.status);
  }

  if (tab === 'inbound') {
    return INBOUND_STATUSES.has(unit.status);
  }

  return REPORT_STATUSES.has(unit.status) || !unit.currentLocation || isStagedAging(unit);
}

function getLogisticsDateWindow(dateRange: LogisticsDateSelection) {
  const fallback = getTodayDateSelection();
  const start = parseDateInputValue(dateRange.startDate) ?? parseDateInputValue(fallback.startDate);
  const end = parseDateInputValue(dateRange.endDate) ?? parseDateInputValue(fallback.endDate);
  const from = start && end && start > end ? end : start;
  const inclusiveEnd = start && end && start > end ? start : end;
  const to = new Date(inclusiveEnd ?? new Date());
  to.setDate(to.getDate() + 1);

  return { from: from ?? new Date(), to };
}

function getTodayDateSelection(): LogisticsDateSelection {
  const today = formatDateInputValue(new Date());

  return { startDate: today, endDate: today };
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizeDatepickerValue(value: unknown, fallbackYmd: string) {
  if (!value) {
    return fallbackYmd;
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return formatDateInputValue(value);
  }

  return fallbackYmd;
}

function formatDateRangeButtonLabel(dateRange: LogisticsDateSelection) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const start = parseDateInputValue(dateRange.startDate);
  const end = parseDateInputValue(dateRange.endDate);

  if (!start || !end) {
    return 'Select dates';
  }

  if (dateRange.startDate === dateRange.endDate) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function isStagedAging(unit: WmsInventoryUnitRecord) {
  if (unit.status !== 'STAGED') {
    return false;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;

  return Date.now() - new Date(unit.updatedAt).getTime() > oneDayMs;
}

function getLogisticsReportTone(unit: WmsInventoryUnitRecord, tab: LogisticsTab) {
  if (tab === 'reports' || unit.status === 'DAMAGED' || unit.status === 'RTS' || !unit.currentLocation) {
    return {
      label: 'Exception',
      className: 'text-rose-600',
      dotClassName: 'bg-rose-500',
    };
  }

  if (isStagedAging(unit)) {
    return {
      label: 'Delayed',
      className: 'text-amber-600',
      dotClassName: 'bg-amber-500',
    };
  }

  return {
    label: 'On time',
    className: 'text-emerald-600',
    dotClassName: 'bg-emerald-500',
  };
}
