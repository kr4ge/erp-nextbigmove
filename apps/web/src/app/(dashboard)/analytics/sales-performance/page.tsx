'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { BarChart3, Filter } from 'lucide-react';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Manila';

const formatDateInTimezone = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const parseYmdToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

type SalesPerformanceRow = {
  salesAssignee: string | null;
  shopId: string;
  orderCount: number;
  totalCod: number;
  salesCod: number;
  mktgCod: number;
  upsellDelta: number;
  confirmedCount: number;
  marketingLeadCount: number;
  deliveredCount: number;
  rtsCount: number;
  pendingCount: number;
  cancelledCount: number;
  upsellCount: number;
  statusCounts: Record<string, number>;
  salesVsMktgPct: number;
  confirmationRatePct: number;
  rtsRatePct: number;
  pendingRatePct: number;
  cancellationRatePct: number;
};

type OverviewResponse = {
  summary: {
    upsell_delta: number;
    sales_cod: number;
    mktg_cod: number;
    sales_vs_mktg_pct: number;
    confirmed_count: number;
    marketing_lead_count: number;
    confirmation_rate_pct: number;
    delivered_count: number;
    rts_count: number;
    rts_rate_pct: number;
    pending_count: number;
    cancelled_count: number;
    pending_rate_pct: number;
    cancellation_rate_pct: number;
    upsell_rate_pct: number;
    total_cod: number;
    order_count: number;
    upsell_count: number;
    for_upsell_count: number;
    upsell_tag_count: number;
  };
  prevSummary: {
    upsell_delta: number;
    sales_cod: number;
    mktg_cod: number;
    sales_vs_mktg_pct: number;
    confirmed_count: number;
    marketing_lead_count: number;
    confirmation_rate_pct: number;
    delivered_count: number;
    rts_count: number;
    rts_rate_pct: number;
    pending_count: number;
    cancelled_count: number;
    pending_rate_pct: number;
    cancellation_rate_pct: number;
    total_cod: number;
    order_count: number;
    upsell_count: number;
  };
  rows: SalesPerformanceRow[];
  filters: {
    salesAssignees: string[];
    salesAssigneesDisplayMap?: Record<string, string>;
    includeUnassigned: boolean;
  };
  selected: {
    start_date: string;
    end_date: string;
    sales_assignees: string[];
  };
  rangeDays: number;
  lastUpdatedAt: string | null;
};

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

const formatPct = (val?: number) => `${(val || 0).toFixed(2)}%`;

const metricDefinitions: { key: keyof OverviewResponse['summary']; label: string; format: 'currency' | 'percent' | 'number' }[] = [
  { key: 'mktg_cod', label: 'MKTG Cod (₱)', format: 'currency' },
  { key: 'sales_cod', label: 'Sales Cod (₱)', format: 'currency' },
  { key: 'sales_vs_mktg_pct', label: 'SMP %', format: 'percent' },
  { key: 'rts_rate_pct', label: 'RTS Rate (%)', format: 'percent' },
  { key: 'confirmation_rate_pct', label: 'Confirmation Rate (%)', format: 'percent' },
  { key: 'pending_rate_pct', label: 'Pending Rate (%)', format: 'percent' },
  { key: 'cancellation_rate_pct', label: 'Cancellation Rate (%)', format: 'percent' },
  { key: 'upsell_rate_pct', label: 'Upsell Rate (%)', format: 'percent' },
];

const formatValue = (val: number, format: 'currency' | 'percent' | 'number') => {
  if (!Number.isFinite(val)) return '—';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(val);
  }
  if (format === 'percent') {
    return `${val.toFixed(2)}%`;
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
};

const formatDelta = (current: number, previous: number) => {
  if (!Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

export default function SalesPerformancePage() {
  const today = formatDateInTimezone(new Date());
  const [range, setRange] = useState({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [assigneeDisplayMap, setAssigneeDisplayMap] = useState<Record<string, string>>({});
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  const assigneePickerRef = useRef<HTMLDivElement>(null);

  const allAssigneeOptions = useMemo(() => {
    const base = [...assigneeOptions];
    if (includeUnassigned) base.push('__null__');
    return base;
  }, [assigneeOptions, includeUnassigned]);

  const resolvedSelection = useMemo(
    () => (selectedAssignees.length === 0 ? allAssigneeOptions : selectedAssignees),
    [selectedAssignees, allAssigneeOptions],
  );

  const selectedLabel =
    resolvedSelection.length === 0 || resolvedSelection.length === allAssigneeOptions.length
      ? 'All sales assignees'
      : `${resolvedSelection.length} selected`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneePickerRef.current && !assigneePickerRef.current.contains(event.target as Node)) {
        setShowAssigneePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<OverviewResponse>('/analytics/sales-performance/overview', {
          params: {
            start_date: startDate,
            end_date: endDate,
            sales_assignee: resolvedSelection,
          },
        });
        if (!isMounted) return;
        setData(res.data);
        setAssigneeOptions(res.data.filters.salesAssignees || []);
        setAssigneeDisplayMap(res.data.filters.salesAssigneesDisplayMap || {});
        setIncludeUnassigned(!!res.data.filters.includeUnassigned);
        if (!hasInitializedSelection) {
          const nextAll = [
            ...(res.data.filters.salesAssignees || []),
            ...(res.data.filters.includeUnassigned ? ['__null__'] : []),
          ];
          setSelectedAssignees(nextAll);
          setHasInitializedSelection(true);
        } else {
          const allowed = new Set([
            ...(res.data.filters.salesAssignees || []),
            ...(res.data.filters.includeUnassigned ? ['__null__'] : []),
          ]);
          setSelectedAssignees((prev) => prev.filter((v) => allowed.has(v)));
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load sales performance overview', error);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadOverview();
    return () => {
      isMounted = false;
    };
  }, [startDate, endDate, resolvedSelection.join('|')]);

  const toggleAssignee = (value: string) => {
    if (resolvedSelection.includes(value)) {
      setSelectedAssignees(resolvedSelection.filter((v) => v !== value));
    } else {
      setSelectedAssignees([...resolvedSelection, value]);
    }
    setShowAssigneePicker(true);
  };

  const displayAssignee = (value: string | null) => {
    if (!value || value === '__null__') {
      return assigneeDisplayMap['__null__'] || 'Unassigned';
    }
    return (
      assigneeDisplayMap[value] ||
      assigneeDisplayMap[value.toLowerCase()] ||
      value
    );
  };

  const filteredOptions = allAssigneeOptions.filter((value) =>
    assigneeSearch.trim()
      ? displayAssignee(value).toLowerCase().includes(assigneeSearch.toLowerCase())
      : true,
  );

  const metrics = useMemo(() => {
    return metricDefinitions.map((def) => {
      const current = data?.summary?.[def.key] ?? 0;
      const previous = data?.prevSummary?.[def.key] ?? 0;
      return {
        ...def,
        current,
        previous,
        delta: formatDelta(current, previous),
      };
    });
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Performance"
        description="Track performance by sales assignee and shop to understand upsell impact."
      />

      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </span>
            <p className="text-lg font-semibold text-slate-900">Monitoring</p>
          </div>
          <p className="text-sm text-slate-400">
            Last updated:{' '}
            <span className="font-medium text-slate-600">
              {data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : '—'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Sales Assignee</p>
            <div className="relative" ref={assigneePickerRef}>
              <button
                type="button"
                onClick={() => setShowAssigneePicker((p) => !p)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none"
              >
                <span className="text-slate-900">{selectedLabel}</span>
                <span className="text-slate-400 text-xs">(click to choose)</span>
              </button>
              {showAssigneePicker && (
                <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 border-b border-slate-100">
                    <span>Select assignees</span>
                    <button
                      type="button"
                      onClick={() => setSelectedAssignees([])}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      placeholder="Type to search"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={resolvedSelection.length === allAssigneeOptions.length && allAssigneeOptions.length > 0}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedAssignees(checked ? allAssigneeOptions : []);
                            setShowAssigneePicker(true);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>All</span>
                      </label>
                    </div>
                    {filteredOptions.map((value) => {
                      const checked = resolvedSelection.includes(value);
                      return (
                        <div
                          key={value}
                          className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAssignee(value)}
                              className="rounded border-slate-300"
                            />
                            <span>{displayAssignee(value)}</span>
                          </label>
                          <button
                            type="button"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                            onClick={() => {
                              setSelectedAssignees([value]);
                              setShowAssigneePicker(true);
                            }}
                          >
                            ONLY
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <p className="text-sm font-medium text-slate-700 mb-1.5">Date range</p>
            <div className="flex items-end gap-2">
              <div className="relative">
                <Datepicker
                  value={range}
                  onChange={(val: any) => {
                    const nextStart = val?.startDate || today;
                    const nextEnd = val?.endDate || today;
                    setRange({ startDate: nextStart, endDate: nextEnd });
                    const formatDate = (d: any) => {
                      if (!d) return today;
                      if (typeof d === 'string') return d.slice(0, 10);
                      if (d instanceof Date) return formatDateInTimezone(d);
                      return today;
                    };
                    setStartDate(formatDate(nextStart));
                    setEndDate(formatDate(nextEnd));
                  }}
                  inputClassName="rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-300"
                  containerClassName=""
                  popupClassName={(defaultClass: string) => `${defaultClass} z-50`}
                  displayFormat="MM/DD/YYYY"
                  separator=" – "
                  toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  placeholder=""
                />
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 bg-white hover:border-slate-300"
                aria-label="Filters"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-5">
          {isLoading
            ? Array.from({ length: metricDefinitions.length }).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 animate-pulse">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="mt-1.5 h-5 w-16 bg-slate-200 rounded" />
                  <div className="mt-1 h-2.5 w-14 bg-slate-200 rounded" />
                </div>
              ))
            : metrics.map((m) => {
                const delta = m.delta;
                const deltaLabel =
                  delta === null ? 'N/A' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
                const deltaColor =
                  delta === null ? 'text-slate-400' : delta >= 0 ? 'text-emerald-600' : 'text-rose-500';
                return (
                  <div
                    key={m.key}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatValue(m.current, m.format)}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${deltaColor}`}>
                      {deltaLabel}
                      {data?.rangeDays ? ` from previous ${data.rangeDays} day${data.rangeDays > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                );
              })}
        </div>
      </Card>

      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3 px-2">
          <h2 className="text-lg font-semibold text-slate-900">Sales Performance</h2>
          <span className="text-xs text-slate-400">{data?.rows?.length || 0} rows</span>
        </div>
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Sales Assignee
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Shop POS
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    MKTG Cod
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Sales Cod
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    SMP %
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    RTS Rate %
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Confirmation Rate %
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Pending Rate %
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Cancellation Rate %
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Upsell Rate %
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    Sales Upsell
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={11}>
                      Loading...
                    </td>
                  </tr>
                ) : data?.rows?.length ? (
                  data.rows.map((row) => (
                    <tr key={`${row.salesAssignee ?? 'unassigned'}-${row.shopId}`} className="bg-white">
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        {displayAssignee(row.salesAssignee)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">{row.shopId}</td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        {formatCurrency(row.mktgCod)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        {formatCurrency(row.salesCod)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPct(row.salesVsMktgPct)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPct(row.rtsRatePct)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPct(row.confirmationRatePct)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPct(row.pendingRatePct)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPct(row.cancellationRatePct)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPct(row.upsellRatePct)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        {formatCurrency(row.upsellDelta)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={11}>
                      No data available for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
