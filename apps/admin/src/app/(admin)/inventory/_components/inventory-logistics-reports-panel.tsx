'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
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

type InventoryLogisticsReportsPanelProps = {
  units: WmsInventoryUnitRecord[];
  dateRange?: LogisticsDateSelection;
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
  'DEADSTOCK',
  'RTS',
  'DAMAGED',
  'LOST',
  'ARCHIVED',
]);
const LOGISTICS_PAGE_SIZE = 4;

export function InventoryLogisticsReportsPanel({
  units,
  dateRange = getTodayDateSelection(),
}: InventoryLogisticsReportsPanelProps) {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('inbound');
  const [pageIndex, setPageIndex] = useState(0);
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

  useEffect(() => {
    setPageIndex(0);
  }, [activeTab, dateRange.startDate, dateRange.endDate, units]);

  return (
    <WmsCompactPanel
      title="Logistics Reports"
      icon={<BarChart3 className='panel-icon' />}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-6 border-b border-slate-200">
          {LOGISTICS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                activeTab === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        {hasCarousel ? (
          <button
            type="button"
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            disabled={safePageIndex === 0}
            className="absolute left-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
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
            <div className="col-span-full flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[#dce4ea] bg-[#fbfcfd] px-4 text-center text-sm text-[#6f8290]">
              No units found for this date range.
            </div>
          )}
        </div>

        {hasCarousel ? (
          <button
            type="button"
            onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePageIndex >= totalPages - 1}
            className="absolute right-0 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center"
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
                  ? 'w-6 bg-primary'
                  : 'w-2.5 border border-[#cfd9e1] bg-[#dbe3ea] hover:bg-[#b9c7d2]'
              }`}
              aria-label={`Go to logistics page ${index + 1}`}
              aria-current={index === safePageIndex ? 'page' : undefined}
            />
          ))}
        </div>
      ) : null}
    </WmsCompactPanel>
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
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`pill ${getInventoryStatusClassName(unit.status)}`}
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

      <p className="mt-3 truncate text-sm font-semibold text-primary">{unit.code}</p>
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



function isStagedAging(unit: WmsInventoryUnitRecord) {
  if (unit.status !== 'STAGED') {
    return false;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;

  return Date.now() - new Date(unit.updatedAt).getTime() > oneDayMs;
}

function getLogisticsReportTone(unit: WmsInventoryUnitRecord, tab: LogisticsTab) {
  if (unit.status === 'DEADSTOCK') {
    return {
      label: 'Deadstock',
      className: 'text-amber-700',
      dotClassName: 'bg-amber-500',
    };
  }

  if (
    tab === 'reports'
    || unit.status === 'DAMAGED'
    || unit.status === 'LOST'
    || unit.status === 'RTS'
    || !unit.currentLocation
  ) {
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


