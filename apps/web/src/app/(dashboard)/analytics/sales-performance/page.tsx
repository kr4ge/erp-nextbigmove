'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronDown, ChevronUp, Info, Trash2 } from 'lucide-react';

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
  salesCodCount: number;
  mktgCodCount: number;
  upsellDelta: number;
  confirmedCount: number;
  marketingLeadCount: number;
  forUpsellCount: number;
  upsellTagCount: number;
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
  upsellRatePct: number;
};

type SalesPerformanceSummaryRow = Omit<SalesPerformanceRow, 'shopId'>;
type SortKey =
  | 'assignee'
  | 'shop'
  | 'mktg_cod'
  | 'sales_cod'
  | 'smp'
  | 'rts'
  | 'confirmation'
  | 'pending'
  | 'cancellation'
  | 'upsell_rate'
  | 'upsell_delta';

type SalesPerformanceSummary = {
  upsell_delta: number;
  sales_cod: number;
  sales_cod_count: number;
  mktg_cod: number;
  mktg_cod_count: number;
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

type OverviewResponse = {
  summary: SalesPerformanceSummary;
  prevSummary: SalesPerformanceSummary;
  rows: SalesPerformanceRow[];
  filters: {
    salesAssignees: string[];
    salesAssigneesDisplayMap?: Record<string, string>;
    includeUnassigned: boolean;
    shopDisplayMap?: Record<string, string>;
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

const metricDefinitions: { key: keyof OverviewResponse['summary']; label: string; format: 'currency' | 'percent' | 'number'; countKey?: keyof OverviewResponse['summary'] }[] = [
  { key: 'mktg_cod', label: 'MKTG Cod (₱)', format: 'currency', countKey: 'mktg_cod_count' },
  { key: 'sales_cod', label: 'Sales Cod (₱)', format: 'currency', countKey: 'sales_cod_count' },
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

const formatCount = (val?: number) => new Intl.NumberFormat('en-US').format(val ?? 0);

const TooltipRow = ({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex items-center justify-between text-[12px] text-slate-700">
    <span>{label}</span>
    <span className={bold ? 'font-semibold text-slate-900' : ''}>{value}</span>
  </div>
);

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [tableSelection, setTableSelection] = useState<'store' | 'summary'>('summary');
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [storePage, setStorePage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<SortKey>('smp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [assigneeDisplayMap, setAssigneeDisplayMap] = useState<Record<string, string>>({});
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  const assigneePickerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

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
    const handleTableMenuClose = (event: MouseEvent) => {
      if (!showTableMenu) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const path = event.composedPath ? event.composedPath() : [];
      const withinMenu = path.some(
        (node) => (node as HTMLElement | null)?.dataset?.tableMenu === 'true',
      );
      if (!withinMenu) {
        setShowTableMenu(false);
      }
    };
    document.addEventListener('mousedown', handleTableMenuClose);
    return () => document.removeEventListener('mousedown', handleTableMenuClose);
  }, [showTableMenu]);

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
  }, [startDate, endDate, resolvedSelection.join('|'), refreshKey]);

  const rangeLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`;

  const handleDeleteOrders = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await apiClient.post<{ deletedCount: number }>(
        '/analytics/sales-performance/pos-orders/delete-range',
        {
          start_date: startDate,
          end_date: endDate,
        },
      );
      addToast('success', `Deleted ${res.data.deletedCount} POS orders (${rangeLabel}).`);
      setRefreshKey((prev) => prev + 1);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Failed to delete POS orders', error);
      addToast('error', 'Failed to delete POS orders. Please try again.');
      setDeleteError('Failed to delete POS orders. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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

  const displayShop = (value: string) => {
    return data?.filters?.shopDisplayMap?.[value] || value;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'assignee' || key === 'shop' ? 'asc' : 'desc');
  };

  const renderSortLabel = (label: string, key: SortKey) => {
    const isActive = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-slate-500 hover:text-slate-700"
      >
        <span>{label}</span>
        {isActive ? (
          sortDir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    );
  };

  const getSortValue = (row: SalesPerformanceRow | SalesPerformanceSummaryRow, key: SortKey, hasShop: boolean) => {
    switch (key) {
      case 'assignee':
        return displayAssignee(row.salesAssignee).toLowerCase();
      case 'shop':
        if (!hasShop || !('shopId' in row)) return '';
        return displayShop(row.shopId || '').toLowerCase();
      case 'mktg_cod':
        return row.mktgCod;
      case 'sales_cod':
        return row.salesCod;
      case 'smp':
        return row.salesVsMktgPct;
      case 'rts':
        return row.rtsRatePct;
      case 'confirmation':
        return row.confirmationRatePct;
      case 'pending':
        return row.pendingRatePct;
      case 'cancellation':
        return row.cancellationRatePct;
      case 'upsell_rate':
        return row.upsellRatePct;
      case 'upsell_delta':
        return row.upsellDelta;
      default:
        return 0;
    }
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
      const countCurrent = def.countKey ? (data?.summary?.[def.countKey] ?? 0) : null;
      const countPrevious = def.countKey ? (data?.prevSummary?.[def.countKey] ?? 0) : null;
      return {
        ...def,
        current,
        previous,
        countCurrent,
        countPrevious,
        countDelta: def.countKey ? formatDelta(countCurrent ?? 0, countPrevious ?? 0) : null,
        delta: formatDelta(current, previous),
      };
    });
  }, [data]);

  const tooltipFooter = (
    <p className="text-[11px] text-slate-500">
      {startDate} → {endDate} • {selectedLabel}
    </p>
  );

  const buildSmpTooltip = (summary?: SalesPerformanceSummary | null) => {
    if (!summary) return null;
    return (
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-slate-900">SMP % inputs</div>
        <div className="space-y-1">
          <TooltipRow label="Sales Cod" value={formatCurrency(summary.sales_cod)} />
          <TooltipRow label="MKTG Cod" value={formatCurrency(summary.mktg_cod)} />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow label="SMP %" value={formatPct(summary.sales_vs_mktg_pct)} bold />
        </div>
        {tooltipFooter}
      </div>
    );
  };

  const buildRtsRateTooltip = (summary?: SalesPerformanceSummary | null) => {
    if (!summary) return null;
    return (
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-slate-900">RTS Rate inputs</div>
        <div className="space-y-1">
          <TooltipRow label="RTS Orders" value={formatCount(summary.rts_count)} />
          <TooltipRow label="Delivered Orders" value={formatCount(summary.delivered_count)} />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow label="RTS Rate %" value={formatPct(summary.rts_rate_pct)} bold />
        </div>
        {tooltipFooter}
      </div>
    );
  };

  const buildConfirmationTooltip = (summary?: SalesPerformanceSummary | null) => {
    if (!summary) return null;
    return (
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-slate-900">Confirmation Rate inputs</div>
        <div className="space-y-1">
          <TooltipRow label="Confirmed Orders" value={formatCount(summary.confirmed_count)} />
          <TooltipRow label="Total Orders" value={formatCount(summary.order_count)} />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow label="Confirmation Rate %" value={formatPct(summary.confirmation_rate_pct)} bold />
        </div>
        {tooltipFooter}
      </div>
    );
  };

  const buildPendingTooltip = (summary?: SalesPerformanceSummary | null) => {
    if (!summary) return null;
    return (
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-slate-900">Pending Rate inputs</div>
        <div className="space-y-1">
          <TooltipRow label="Pending Orders" value={formatCount(summary.pending_count)} />
          <TooltipRow label="Total Orders" value={formatCount(summary.order_count)} />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow label="Pending Rate %" value={formatPct(summary.pending_rate_pct)} bold />
        </div>
        {tooltipFooter}
      </div>
    );
  };

  const buildCancellationTooltip = (summary?: SalesPerformanceSummary | null) => {
    if (!summary) return null;
    return (
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-slate-900">Cancellation Rate inputs</div>
        <div className="space-y-1">
          <TooltipRow label="Cancelled Orders" value={formatCount(summary.cancelled_count)} />
          <TooltipRow label="Total Orders" value={formatCount(summary.order_count)} />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow label="Cancellation Rate %" value={formatPct(summary.cancellation_rate_pct)} bold />
        </div>
        {tooltipFooter}
      </div>
    );
  };

  const buildUpsellTooltip = (summary?: SalesPerformanceSummary | null) => {
    if (!summary) return null;
    return (
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-slate-900">Upsell Rate inputs</div>
        <div className="space-y-1">
          <TooltipRow label="Upsell Tag Count" value={formatCount(summary.upsell_tag_count)} />
          <TooltipRow label="For Upsell Count" value={formatCount(summary.for_upsell_count)} />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow label="Upsell Rate %" value={formatPct(summary.upsell_rate_pct)} bold />
        </div>
        {tooltipFooter}
      </div>
    );
  };

  const summaryRows = useMemo(() => {
    if (!data?.rows?.length) return [];
    const map = new Map<string, SalesPerformanceSummaryRow>();

    data.rows.forEach((row) => {
      const key = row.salesAssignee ?? '__null__';
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          salesAssignee: row.salesAssignee ?? null,
          orderCount: row.orderCount,
          totalCod: row.totalCod,
          salesCod: row.salesCod,
          salesCodCount: row.salesCodCount,
          mktgCod: row.mktgCod,
          mktgCodCount: row.mktgCodCount,
          upsellDelta: row.upsellDelta,
          confirmedCount: row.confirmedCount,
          marketingLeadCount: row.marketingLeadCount,
          forUpsellCount: row.forUpsellCount,
          upsellTagCount: row.upsellTagCount,
          deliveredCount: row.deliveredCount,
          rtsCount: row.rtsCount,
          pendingCount: row.pendingCount,
          cancelledCount: row.cancelledCount,
          upsellCount: row.upsellCount,
          statusCounts: { ...row.statusCounts },
          salesVsMktgPct: 0,
          confirmationRatePct: 0,
          rtsRatePct: 0,
          pendingRatePct: 0,
          cancellationRatePct: 0,
          upsellRatePct: 0,
        });
        return;
      }

      existing.orderCount += row.orderCount;
      existing.totalCod += row.totalCod;
      existing.salesCod += row.salesCod;
      existing.salesCodCount += row.salesCodCount;
      existing.mktgCod += row.mktgCod;
      existing.mktgCodCount += row.mktgCodCount;
      existing.upsellDelta += row.upsellDelta;
      existing.confirmedCount += row.confirmedCount;
      existing.marketingLeadCount += row.marketingLeadCount;
      existing.forUpsellCount += row.forUpsellCount;
      existing.upsellTagCount += row.upsellTagCount;
      existing.deliveredCount += row.deliveredCount;
      existing.rtsCount += row.rtsCount;
      existing.pendingCount += row.pendingCount;
      existing.cancelledCount += row.cancelledCount;
      existing.upsellCount += row.upsellCount;
      Object.entries(row.statusCounts || {}).forEach(([status, count]) => {
        existing.statusCounts[status] = (existing.statusCounts[status] || 0) + count;
      });
    });

    return Array.from(map.values()).map((row) => {
      const rtsDenominator = row.deliveredCount + row.rtsCount;
      return {
        ...row,
        salesVsMktgPct: row.mktgCod > 0 ? (row.salesCod / row.mktgCod) * 100 : 0,
        confirmationRatePct:
          row.orderCount > 0 ? (row.confirmedCount / row.orderCount) * 100 : 0,
        rtsRatePct: rtsDenominator > 0 ? (row.rtsCount / rtsDenominator) * 100 : 0,
        pendingRatePct: row.orderCount > 0 ? (row.pendingCount / row.orderCount) * 100 : 0,
        cancellationRatePct: row.orderCount > 0 ? (row.cancelledCount / row.orderCount) * 100 : 0,
        upsellRatePct: row.forUpsellCount > 0 ? (row.upsellTagCount / row.forUpsellCount) * 100 : 0,
      };
    });
  }, [data?.rows]);

  useEffect(() => {
    setStorePage(1);
  }, [data?.rows?.length]);

  useEffect(() => {
    setSummaryPage(1);
  }, [summaryRows.length]);

  useEffect(() => {
    setStorePage(1);
    setSummaryPage(1);
  }, [sortKey, sortDir]);

  useEffect(() => {
    if (tableSelection === 'summary' && sortKey === 'shop') {
      setSortKey('assignee');
      setSortDir('asc');
    }
  }, [tableSelection, sortKey]);

  const tableOptions: Array<{ key: 'store' | 'summary'; label: string }> = [
    { key: 'summary', label: 'Sales Performance' },
    { key: 'store', label: 'Sales Performance (Per Store)' },
  ];

  const sortedStoreRows = useMemo(() => {
    const rows = [...(data?.rows || [])];
    if (rows.length === 0) return rows;
    return rows.sort((a, b) => {
      const av = getSortValue(a, sortKey, true);
      const bv = getSortValue(b, sortKey, true);
      if (typeof av === 'string' || typeof bv === 'string') {
        return (sortDir === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv));
      }
      return (sortDir === 'asc' ? 1 : -1) * (Number(av) - Number(bv));
    });
  }, [data?.rows, sortKey, sortDir]);

  const sortedSummaryRows = useMemo(() => {
    const rows = [...summaryRows];
    if (rows.length === 0) return rows;
    return rows.sort((a, b) => {
      const av = getSortValue(a, sortKey, false);
      const bv = getSortValue(b, sortKey, false);
      if (typeof av === 'string' || typeof bv === 'string') {
        return (sortDir === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv));
      }
      return (sortDir === 'asc' ? 1 : -1) * (Number(av) - Number(bv));
    });
  }, [summaryRows, sortKey, sortDir]);

  const totalStoreRows = sortedStoreRows.length;
  const totalSummaryRows = sortedSummaryRows.length;
  const totalStorePages = Math.max(1, Math.ceil(totalStoreRows / pageSize));
  const totalSummaryPages = Math.max(1, Math.ceil(totalSummaryRows / pageSize));

  const pagedStoreRows = sortedStoreRows.slice((storePage - 1) * pageSize, storePage * pageSize);
  const pagedSummaryRows = sortedSummaryRows.slice((summaryPage - 1) * pageSize, summaryPage * pageSize);

  const storeStart = totalStoreRows === 0 ? 0 : (storePage - 1) * pageSize + 1;
  const storeEnd = Math.min(storePage * pageSize, totalStoreRows);
  const summaryStart = totalSummaryRows === 0 ? 0 : (summaryPage - 1) * pageSize + 1;
  const summaryEnd = Math.min(summaryPage * pageSize, totalSummaryRows);

  const storeCanPrev = storePage > 1;
  const storeCanNext = storePage < totalStorePages;
  const summaryCanPrev = summaryPage > 1;
  const summaryCanNext = summaryPage < totalSummaryPages;

  const activeRowCount = tableSelection === 'summary' ? totalSummaryRows : totalStoreRows;

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
                onClick={() => {
                  setDeleteError('');
                  setShowDeleteModal(true);
                }}
                className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2.5 py-2 text-rose-600 bg-rose-50 hover:border-rose-300 hover:text-rose-700"
                aria-label="Delete POS orders in range"
              >
                <Trash2 className="h-4 w-4" />
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
                  delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
                const deltaColor =
                  delta === null ? 'text-slate-400' : delta >= 0 ? 'text-emerald-600' : 'text-rose-500';
                const countDeltaLabel =
                  m.countDelta === null || m.countDelta === undefined
                    ? '--'
                    : `${m.countDelta > 0 ? '+' : ''}${m.countDelta.toFixed(1)}%`;
                const countDeltaColor =
                  m.countDelta === null || m.countDelta === undefined
                    ? 'text-slate-400'
                    : m.countDelta >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-500';
                const tooltip =
                  m.key === 'sales_vs_mktg_pct'
                    ? buildSmpTooltip(data?.summary)
                    : m.key === 'rts_rate_pct'
                      ? buildRtsRateTooltip(data?.summary)
                      : m.key === 'confirmation_rate_pct'
                        ? buildConfirmationTooltip(data?.summary)
                        : m.key === 'pending_rate_pct'
                          ? buildPendingTooltip(data?.summary)
                          : m.key === 'cancellation_rate_pct'
                            ? buildCancellationTooltip(data?.summary)
                            : m.key === 'upsell_rate_pct'
                              ? buildUpsellTooltip(data?.summary)
                              : null;
                return (
                  <div
                    key={m.key}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      {m.label}
                      {tooltip && (
                        <span className="relative group inline-flex cursor-help" tabIndex={0} aria-label={`${m.label} formula`}>
                          <Info className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 group-focus-within:text-emerald-600" />
                          <div className="absolute left-1/2 top-full z-30 mt-2 hidden w-80 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-700 shadow-lg group-hover:block group-focus-within:block">
                            {tooltip}
                          </div>
                        </span>
                      )}
                    </div>
                    {m.countKey ? (
                      <>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-lg font-semibold text-slate-900">
                            {formatValue(m.current, m.format)}
                          </p>
                          <p className={`text-[11px] ${deltaColor}`}>{deltaLabel}</p>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-slate-600">
                            ord: <span className="font-semibold text-slate-900">{formatCount(m.countCurrent ?? 0)}</span>
                          </span>
                          <span className={`text-[11px] ${countDeltaColor}`}>{countDeltaLabel}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-lg font-semibold text-slate-900">
                            {formatValue(m.current, m.format)}
                          </p>
                          <p className={`text-[11px] ${deltaColor}`}>{deltaLabel}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
        </div>
      </Card>

      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="relative" data-table-menu="true">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-lg font-semibold text-slate-900"
              onClick={() => setShowTableMenu((p) => !p)}
            >
              {tableOptions.find((t) => t.key === tableSelection)?.label || 'Sales Performance (Per Store)'}
              <span className="text-slate-500">▾</span>
            </button>
            {showTableMenu && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg z-20">
                {tableOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`block w-full text-left px-3 py-2 text-sm ${tableSelection === opt.key ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}
                    onClick={() => {
                      setTableSelection(opt.key);
                      if (opt.key === 'summary') {
                        setSummaryPage(1);
                      } else {
                        setStorePage(1);
                      }
                      setShowTableMenu(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400">{activeRowCount || 0} rows</span>
        </div>

        {tableSelection === 'store' && (
          <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Sales Assignee', 'assignee')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Shop POS', 'shop')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('MKTG Cod', 'mktg_cod')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Sales Cod', 'sales_cod')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('SMP %', 'smp')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('RTS Rate %', 'rts')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Confirmation Rate %', 'confirmation')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Pending Rate %', 'pending')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Cancellation Rate %', 'cancellation')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Upsell Rate %', 'upsell_rate')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Sales Upsell', 'upsell_delta')}
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
                  ) : pagedStoreRows.length ? (
                    pagedStoreRows.map((row) => (
                      <tr key={`${row.salesAssignee ?? 'unassigned'}-${row.shopId}`} className="bg-white">
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                          {displayAssignee(row.salesAssignee)}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                          <span className="text-slate-900">{displayShop(row.shopId)}</span>
                        </td>
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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <p className="text-sm text-slate-600">
              Showing {storeStart}-{storeEnd} of {totalStoreRows}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                disabled={!storeCanPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
                disabled={!storeCanNext || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

        {tableSelection === 'summary' && (
          <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Sales Assignee', 'assignee')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('MKTG Cod', 'mktg_cod')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Sales Cod', 'sales_cod')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('SMP %', 'smp')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('RTS Rate %', 'rts')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Confirmation Rate %', 'confirmation')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Pending Rate %', 'pending')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Cancellation Rate %', 'cancellation')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Upsell Rate %', 'upsell_rate')}
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left whitespace-nowrap">
                      {renderSortLabel('Sales Upsell', 'upsell_delta')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-slate-400" colSpan={10}>
                        Loading...
                      </td>
                    </tr>
                  ) : pagedSummaryRows.length ? (
                    pagedSummaryRows.map((row) => (
                      <tr key={row.salesAssignee ?? 'unassigned'} className="bg-white">
                        <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                          {displayAssignee(row.salesAssignee)}
                        </td>
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
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={10}>
                      No data available for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <p className="text-sm text-slate-600">
              Showing {summaryStart}-{summaryEnd} of {totalSummaryRows}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setSummaryPage((p) => Math.max(1, p - 1))}
                disabled={!summaryCanPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
                disabled={!summaryCanNext || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      </Card>

      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setShowDeleteModal(false);
            setDeleteError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete POS Orders</DialogTitle>
            <DialogDescription>
              This will permanently delete POS orders for the selected date range and update analytics.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              This action cannot be undone.
            </div>
            <div>
              <span className="text-slate-500">Date range:</span>{' '}
              <span className="font-semibold text-slate-900">{rangeLabel}</span>
            </div>
          </div>

          {deleteError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {deleteError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteError('');
              }}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteOrders}
              loading={isDeleting}
              className="flex-1"
            >
              {isDeleting ? 'Deleting...' : 'Delete Orders'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
