'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { AlertBanner } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3, CalendarDays, ChevronDown, Trash2 } from 'lucide-react';
import { AnalyticsMetricCard } from '../_components/analytics-metric-card';
import { AnalyticsMetricCardSkeleton } from '../_components/analytics-metric-card-skeleton';
import { AnalyticsMultiSelectPicker } from '../_components/analytics-multi-select-picker';
import { AnalyticsRiskConfirmationTable } from '../_components/analytics-risk-confirmation-table';
import {
  AnalyticsSalesPerformanceRepurchaseTable,
  type SalesPerformanceRepurchaseRow,
} from '../_components/analytics-sales-performance-repurchase-table';
import { AnalyticsSalesPerformanceStoreTable } from '../_components/analytics-sales-performance-store-table';
import { AnalyticsSalesPerformanceSummaryTable } from '../_components/analytics-sales-performance-summary-table';
import { AnalyticsSortToggleLabel } from '../_components/analytics-sort-toggle-label';
import {
  AnalyticsTableSelector,
  type AnalyticsTableSelectorOption,
} from '../_components/analytics-table-selector';
import {
  formatDateInTimezone,
} from '../_utils/date';
import {
  formatDeltaPercent,
} from '../_utils/metrics';
import { useAnalyticsDateRange } from '../_hooks/use-analytics-date-range';
import { analyticsOverviewApi } from '../_services/analytics-overview-api';
import { DashboardSection } from '../../dashboard/_components/dashboard-section';
import {
  type ProblematicDeliveryResponse,
  type SalesPerformanceOverviewResponse as OverviewResponse,
  type SalesPerformanceRow,
  type SalesPerformanceSortKey as SortKey,
  type SalesPerformanceSummary,
  type SalesPerformanceSummaryRow,
  type SunburstHoverInfo,
  salesPerformanceMetricDefinitions as metricDefinitions,
} from '../_types/sales-performance';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

const formatPct = (val?: number) => `${(val || 0).toFixed(2)}%`;

const formatCount = (val?: number) => new Intl.NumberFormat('en-US').format(val ?? 0);
const formatShortDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const buildSparklineOption = (
  labels: string[],
  data: number[],
  color: string,
  fill: string,
  seriesLabel: string,
) => ({
  animation: false,
  tooltip: {
    trigger: 'axis',
    confine: true,
    formatter: (
      params:
        | { value?: unknown; axisValueLabel?: string; axisValue?: string }
        | Array<{ value?: unknown; axisValueLabel?: string; axisValue?: string }>,
    ) => {
      const row = Array.isArray(params) ? params[0] : params;
      const value = Number(row?.value ?? 0);
      const date = row?.axisValueLabel || row?.axisValue || '';
      return `${seriesLabel}<br/>${date}: ${formatCount(value)}`;
    },
  },
  grid: {
    left: 8,
    right: 8,
    top: 6,
    bottom: 6,
    containLabel: false,
  },
  xAxis: {
    type: 'category',
    data: labels,
    show: false,
    boundaryGap: false,
  },
  yAxis: {
    type: 'value',
    show: false,
    scale: true,
  },
  series: [
    {
      name: seriesLabel,
      type: 'line',
      data,
      smooth: true,
      symbol: 'none',
      lineStyle: { color, width: 4 },
      areaStyle: { color: fill },
    },
  ],
});

const TooltipRow = ({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex items-center justify-between text-[12px] text-slate-700">
    <span>{label}</span>
    <span className={bold ? 'font-semibold text-slate-900' : ''}>{value}</span>
  </div>
);

const areArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areRecordsEqual = (a: Record<string, string>, b: Record<string, string>) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export default function SalesPerformancePage() {
  const { today, range, startDate, endDate, handleDateRangeChange } = useAnalyticsDateRange();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [tableSelection, setTableSelection] = useState<'store' | 'summary'>('summary');
  const [deliveryViewSelection, setDeliveryViewSelection] =
    useState<'delivery' | 'risk_confirmation' | 'repurchase'>('delivery');
  const [showDeliveryViewMenu, setShowDeliveryViewMenu] = useState(false);
  const [storePage, setStorePage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);
  const [riskPage, setRiskPage] = useState(1);
  const [repurchasePage, setRepurchasePage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<SortKey>('smp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [problematicData, setProblematicData] = useState<ProblematicDeliveryResponse | null>(null);
  const [sunburstHoverInfo, setSunburstHoverInfo] = useState<SunburstHoverInfo | null>(null);
  const [isProblematicLoading, setIsProblematicLoading] = useState(false);
  const [chartShopOptions, setChartShopOptions] = useState<string[]>([]);
  const [selectedChartShops, setSelectedChartShops] = useState<string[]>([]);
  const [isAllChartShopsMode, setIsAllChartShopsMode] = useState(true);
  const [hasInitializedChartShops, setHasInitializedChartShops] = useState(false);

  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [assigneeDisplayMap, setAssigneeDisplayMap] = useState<Record<string, string>>({});
  const [includeUnassigned, setIncludeUnassigned] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isAllAssigneesMode, setIsAllAssigneesMode] = useState(true);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  const lastSunburstHoverKeyRef = useRef<string>('');
  const { addToast } = useToast();

  const allAssigneeOptions = useMemo(() => {
    const base = [...assigneeOptions];
    if (includeUnassigned) base.push('__null__');
    return base;
  }, [assigneeOptions, includeUnassigned]);

  const resolvedSelection = useMemo(
    () => (isAllAssigneesMode ? allAssigneeOptions : selectedAssignees),
    [isAllAssigneesMode, selectedAssignees, allAssigneeOptions],
  );

  const selectedLabel =
    isAllAssigneesMode ? 'All sales assignees' : `${selectedAssignees.length} selected`;

  const resolvedChartShops = useMemo(
    () => (isAllChartShopsMode ? chartShopOptions : selectedChartShops),
    [isAllChartShopsMode, selectedChartShops, chartShopOptions],
  );

  const selectedChartShopLabel =
    isAllChartShopsMode ? 'All shops' : `${selectedChartShops.length} selected`;

  const salesPerformanceDateRangeIsToday = startDate === today && endDate === today;
  const formatDateRangeButtonDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  };
  const salesPerformanceDateRangeButtonLabel =
    startDate === endDate
      ? formatDateRangeButtonDate(startDate)
      : `${formatDateRangeButtonDate(startDate)} - ${formatDateRangeButtonDate(endDate)}`;

  useEffect(() => {
    const handleDeliveryMenuClose = (event: MouseEvent) => {
      if (!showDeliveryViewMenu) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const path = event.composedPath ? event.composedPath() : [];
      const withinMenu = path.some(
        (node) => (node as HTMLElement | null)?.dataset?.deliveryMenu === 'true',
      );
      if (!withinMenu) {
        setShowDeliveryViewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleDeliveryMenuClose);
    return () => document.removeEventListener('mousedown', handleDeliveryMenuClose);
  }, [showDeliveryViewMenu]);

  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | string[]> = {
          start_date: startDate,
          end_date: endDate,
        };
        if (!isAllAssigneesMode) {
          params.sales_assignee =
            selectedAssignees.length > 0 ? selectedAssignees : ['__no_selection__'];
        }

        const res =
          await analyticsOverviewApi.getSalesPerformanceOverview<OverviewResponse>(params);
        if (!isMounted) return;
        setData(res.data);
        const nextAssignees = res.data.filters.salesAssignees || [];
        const nextAssigneeDisplayMap = res.data.filters.salesAssigneesDisplayMap || {};
        const nextIncludeUnassigned = !!res.data.filters.includeUnassigned;
        setAssigneeOptions((prev) => (areArraysEqual(prev, nextAssignees) ? prev : nextAssignees));
        setAssigneeDisplayMap((prev) =>
          areRecordsEqual(prev, nextAssigneeDisplayMap) ? prev : nextAssigneeDisplayMap,
        );
        setIncludeUnassigned((prev) =>
          prev === nextIncludeUnassigned ? prev : nextIncludeUnassigned,
        );
        const nextAll = [
          ...(res.data.filters.salesAssignees || []),
          ...(res.data.filters.includeUnassigned ? ['__null__'] : []),
        ];
        if (!hasInitializedSelection || isAllAssigneesMode) {
          setSelectedAssignees((prev) => (prev.length === 0 ? prev : []));
        } else {
          const allowed = new Set(nextAll);
          setSelectedAssignees((prev) => {
            const next = prev.filter((v) => allowed.has(v));
            return areArraysEqual(prev, next) ? prev : next;
          });
        }
        if (!hasInitializedSelection) setHasInitializedSelection(true);
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
  }, [
    endDate,
    hasInitializedSelection,
    isAllAssigneesMode,
    refreshKey,
    selectedAssignees,
    startDate,
  ]);

  useEffect(() => {
    let isMounted = true;
    const loadProblematicDelivery = async () => {
      setSunburstHoverInfo(null);
      lastSunburstHoverKeyRef.current = '';
      setIsProblematicLoading(true);
      try {
        const params: Record<string, string | string[]> = {
          start_date: startDate,
          end_date: endDate,
        };
        if (!isAllChartShopsMode) {
          params.shop_id =
            selectedChartShops.length > 0 ? selectedChartShops : ['__no_selection__'];
        }

        const res = await analyticsOverviewApi.getProblematicDelivery<ProblematicDeliveryResponse>(
          params,
        );
        if (!isMounted) return;
        setProblematicData(res.data);
        const nextShops = res.data.filters.shops || [];
        setChartShopOptions((prev) => (areArraysEqual(prev, nextShops) ? prev : nextShops));
        if (!hasInitializedChartShops || isAllChartShopsMode) {
          setSelectedChartShops((prev) => (prev.length === 0 ? prev : []));
        } else {
          const allowed = new Set(res.data.filters.shops || []);
          setSelectedChartShops((prev) => {
            const next = prev.filter((v) => allowed.has(v));
            return areArraysEqual(prev, next) ? prev : next;
          });
        }
        if (!hasInitializedChartShops) setHasInitializedChartShops(true);
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load problematic delivery chart', error);
        }
      } finally {
        if (isMounted) setIsProblematicLoading(false);
      }
    };
    loadProblematicDelivery();
    return () => {
      isMounted = false;
    };
  }, [
    endDate,
    hasInitializedChartShops,
    isAllChartShopsMode,
    refreshKey,
    selectedChartShops,
    startDate,
  ]);

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
    if (isAllAssigneesMode) {
      setIsAllAssigneesMode(false);
      setSelectedAssignees(allAssigneeOptions.filter((v) => v !== value));
      return;
    }
    const has = selectedAssignees.includes(value);
    const next = has
      ? selectedAssignees.filter((v) => v !== value)
      : [...selectedAssignees, value];
    if (allAssigneeOptions.length > 0 && next.length === allAssigneeOptions.length) {
      setIsAllAssigneesMode(true);
      setSelectedAssignees([]);
    } else {
      setSelectedAssignees(next);
    }
  };

  const displayAssignee = useCallback((value: string | null) => {
    if (!value || value === '__null__') {
      return assigneeDisplayMap['__null__'] || 'Unassigned';
    }
    return (
      assigneeDisplayMap[value] ||
      assigneeDisplayMap[value.toLowerCase()] ||
      value
    );
  }, [assigneeDisplayMap]);

  const displayShop = useCallback((value: string) => {
    return data?.filters?.shopDisplayMap?.[value] || value;
  }, [data?.filters?.shopDisplayMap]);

  const displayChartShop = (value: string) => {
    return problematicData?.filters?.shopDisplayMap?.[value] || data?.filters?.shopDisplayMap?.[value] || value;
  };

  const assigneePickerOptions = allAssigneeOptions.map((value) => ({
    value,
    label: displayAssignee(value),
  }));

  const chartShopPickerOptions = chartShopOptions.map((value) => ({
    value,
    label: displayChartShop(value),
  }));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'assignee' || key === 'shop' ? 'asc' : 'desc');
  };

  const renderSortLabel = (label: string, key: SortKey) => {
    return (
      <AnalyticsSortToggleLabel
        label={label}
        isActive={sortKey === key}
        direction={sortDir}
        onToggle={() => handleSort(key)}
      />
    );
  };

  const getSortValue = useCallback((row: SalesPerformanceRow | SalesPerformanceSummaryRow, key: SortKey, hasShop: boolean) => {
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
  }, [displayAssignee, displayShop]);

  const toggleChartShop = (value: string) => {
    if (isAllChartShopsMode) {
      setIsAllChartShopsMode(false);
      setSelectedChartShops(chartShopOptions.filter((v) => v !== value));
      return;
    }
    const has = selectedChartShops.includes(value);
    const next = has
      ? selectedChartShops.filter((v) => v !== value)
      : [...selectedChartShops, value];
    if (chartShopOptions.length > 0 && next.length === chartShopOptions.length) {
      setIsAllChartShopsMode(true);
      setSelectedChartShops([]);
    } else {
      setSelectedChartShops(next);
    }
  };

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
        countDelta: def.countKey ? formatDeltaPercent(countCurrent ?? 0, countPrevious ?? 0) : null,
        delta: formatDeltaPercent(current, previous),
      };
    });
  }, [data]);

  const tooltipFooter = (
    <p className="text-xs text-slate-500">
      {startDate} → {endDate} • {selectedLabel}
    </p>
  );

  const sunburstSeriesData = useMemo(() => {
    // Keep one hue family per L1 branch, then vary only lightness/saturation by depth.
    const baseHues = [24, 205, 142, 268, 347, 192, 48, 285];
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const tone = (hue: number, saturation: number, lightness: number) =>
      `hsl(${hue}, ${clamp(saturation, 35, 95)}%, ${clamp(lightness, 20, 88)}%)`;

    return (problematicData?.data || []).map((l1, l1Index) => {
      const hue = baseHues[l1Index % baseHues.length];
      return {
        ...l1,
        itemStyle: { color: tone(hue, 90, 52) },
        children: (l1.children || []).map((l2, l2Index) => ({
          ...l2,
          itemStyle: { color: tone(hue, 80 - (l2Index % 3) * 4, 60 + (l2Index % 4) * 2) },
          children: (l2.children || []).map((l3, l3Index) => ({
            ...l3,
            itemStyle: { color: tone(hue, 72 - (l3Index % 4) * 4, 69 + (l3Index % 5) * 2) },
          })),
        })),
      };
    });
  }, [problematicData?.data]);

  const chartOption = useMemo(
    () => ({
      tooltip: {
        show: false,
      },
      series: [
        {
          type: 'sunburst',
          radius: ['2%', '94%'],
          data: sunburstSeriesData,
          sort: null,
          nodeClick: false,
          animation: false,
          animationDurationUpdate: 0,
          label: { show: false },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
          },
          levels: [
            {},
            {
              r0: '8%',
              r: '24%',
              itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
              label: { show: false },
            },
            {
              r0: '34%',
              r: '50%',
              itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
              label: { show: false },
            },
            {
              r0: '60%',
              r: '76%',
              itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
              label: { show: false },
            },
          ],
          emphasis: {
            focus: 'ancestor',
            itemStyle: {
              opacity: 1,
              borderColor: '#ffffff',
              borderWidth: 2,
            },
          },
          blur: {
            itemStyle: {
              opacity: 0.22,
              borderColor: '#ffffff',
              borderWidth: 2,
            },
          },
        },
      ],
    }),
    [sunburstSeriesData],
  );

  const sunburstEvents = useMemo(
    () => ({
      mouseover: (params: {
        seriesType?: string;
        treePathInfo?: Array<{ name?: string }>;
        name?: string;
        value?: unknown;
        color?: unknown;
      }) => {
        if (params?.seriesType !== 'sunburst') return;
        const path =
          params?.treePathInfo
            ?.slice(1)
            ?.map((p) => p?.name)
            ?.filter((name: string | undefined) => !!name)
            ?.join(' / ') || params?.name || 'Unknown';
        const orders = Number(params?.value || 0);
        const total = Number(problematicData?.total || 0);
        const pct = total > 0 ? (orders / total) * 100 : 0;
        const color = typeof params?.color === 'string' ? params.color : '#94A3B8';
        const key = `${path}|${orders}|${pct.toFixed(4)}|${color}`;
        if (lastSunburstHoverKeyRef.current === key) {
          return;
        }
        lastSunburstHoverKeyRef.current = key;
        setSunburstHoverInfo({ path, orders, pct, color });
      },
      globalout: () => {
        if (!lastSunburstHoverKeyRef.current) return;
        lastSunburstHoverKeyRef.current = '';
        setSunburstHoverInfo(null);
      },
    }),
    [problematicData?.total],
  );

  const sunburstLegend = useMemo(
    () =>
      (sunburstSeriesData || []).map((node: {
        name?: string;
        value?: unknown;
        itemStyle?: { color?: string };
      }) => ({
        name: node?.name || 'Unknown',
        count: Number(node?.value || 0),
        color: node?.itemStyle?.color || '#94A3B8',
      })),
    [sunburstSeriesData],
  );

  const trendChartData = useMemo(() => {
    const trend = problematicData?.trend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split('-').map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    });
    const delivered = trend.map((row) => row.delivered_count || 0);
    const rts = trend.map((row) => row.rts_count || 0);
    const deliveredTotal = delivered.reduce((sum, value) => sum + value, 0);
    const rtsTotal = rts.reduce((sum, value) => sum + value, 0);
    return { labels, delivered, rts, deliveredTotal, rtsTotal };
  }, [problematicData?.trend]);

  const undeliverableChartData = useMemo(() => {
    const trend = problematicData?.undeliverableTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split('-').map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [problematicData?.undeliverableTrend]);

  const undeliverableSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        undeliverableChartData.labels,
        undeliverableChartData.counts,
        '#0EA5E9',
        'rgba(14,165,233,0.20)',
        'Undeliverable',
      ),
    [undeliverableChartData],
  );

  const onDeliveryChartData = useMemo(() => {
    const trend = problematicData?.onDeliveryTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split('-').map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [problematicData?.onDeliveryTrend]);

  const onDeliverySparklineOption = useMemo(
    () =>
      buildSparklineOption(
        onDeliveryChartData.labels,
        onDeliveryChartData.counts,
        '#7C3AED',
        'rgba(124,58,237,0.20)',
        'On Delivery',
      ),
    [onDeliveryChartData],
  );

  const deliveredInRangeChartData = useMemo(() => {
    const trend = problematicData?.deliveredInRangeTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split('-').map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [problematicData?.deliveredInRangeTrend]);

  const deliveredInRangeSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        deliveredInRangeChartData.labels,
        deliveredInRangeChartData.counts,
        '#16A34A',
        'rgba(22,163,74,0.20)',
        'Delivered',
      ),
    [deliveredInRangeChartData],
  );

  const returnedInRangeChartData = useMemo(() => {
    const trend = problematicData?.returnedInRangeTrend || [];
    const labels = trend.map((row) => {
      const [year, month, day] = row.date.split('-').map(Number);
      if (!year || !month || !day) return row.date;
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    });
    const counts = trend.map((row) => row.count || 0);
    return { labels, counts };
  }, [problematicData?.returnedInRangeTrend]);

  const returnedInRangeSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        returnedInRangeChartData.labels,
        returnedInRangeChartData.counts,
        '#DC2626',
        'rgba(220,38,38,0.20)',
        'Returned',
      ),
    [returnedInRangeChartData],
  );

  const deliveredInRangeLabel = useMemo(() => {
    if (startDate !== endDate) {
      return `Delivered ${formatShortDate(startDate)} → ${formatShortDate(endDate)}`;
    }

    const now = new Date();
    const todayStr = formatDateInTimezone(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateInTimezone(yesterday);

    if (startDate === todayStr) return 'Delivered Today';
    if (startDate === yesterdayStr) return 'Delivered Yesterday';
    return `Delivered ${formatShortDate(startDate)}`;
  }, [startDate, endDate]);

  const returnedInRangeLabel = useMemo(() => {
    if (startDate !== endDate) {
      return `Returned ${formatShortDate(startDate)} → ${formatShortDate(endDate)}`;
    }

    const now = new Date();
    const todayStr = formatDateInTimezone(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateInTimezone(yesterday);

    if (startDate === todayStr) return 'Returned Today';
    if (startDate === yesterdayStr) return 'Returned Yesterday';
    return `Returned ${formatShortDate(startDate)}`;
  }, [startDate, endDate]);

  const trendLineOption = useMemo(() => {
    const { labels, delivered, rts } = trendChartData;

    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['Delivered', 'RTS'],
        top: 6,
        left: 12,
      },
      grid: {
        left: 16,
        right: 16,
        top: 42,
        bottom: 20,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: { color: '#E2E8F0' },
        },
      },
      series: [
        {
          name: 'Delivered',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: delivered,
          lineStyle: { color: '#16A34A', width: 3 },
          itemStyle: { color: '#16A34A' },
          areaStyle: {
            color: 'rgba(22,163,74,0.10)',
          },
        },
        {
          name: 'RTS',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: rts,
          lineStyle: { color: '#F97316', width: 3 },
          itemStyle: { color: '#F97316' },
          areaStyle: {
            color: 'rgba(249,115,22,0.10)',
          },
        },
      ],
    };
  }, [trendChartData]);

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
    setRiskPage(1);
  }, [problematicData?.riskConfirmationRows?.length, deliveryViewSelection]);

  useEffect(() => {
    setRepurchasePage(1);
  }, [deliveryViewSelection, resolvedChartShops, chartShopOptions]);

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

  const tableOptions: AnalyticsTableSelectorOption<'store' | 'summary'>[] = [
    { key: 'summary', label: 'Sales Performance' },
    { key: 'store', label: 'Sales Performance (Per Store)' },
  ];

  const deliveryViewOptions: Array<{
    key: 'delivery' | 'risk_confirmation' | 'repurchase';
    label: string;
  }> = [
    { key: 'delivery', label: 'Delivery Monitoring' },
    { key: 'risk_confirmation', label: 'Risk Confirmation' },
    { key: 'repurchase', label: 'Repurchase Orders' },
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
  }, [data?.rows, getSortValue, sortKey, sortDir]);

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
  }, [getSortValue, summaryRows, sortKey, sortDir]);

  const totalStoreRows = sortedStoreRows.length;
  const totalSummaryRows = sortedSummaryRows.length;
  const riskRows = problematicData?.riskConfirmationRows || [];
  const repurchaseRows = useMemo<SalesPerformanceRepurchaseRow[]>(() => {
    const shopIds = resolvedChartShops.length > 0
      ? resolvedChartShops
      : chartShopOptions;

    return shopIds.map((shopId) => ({
      shop: displayChartShop(shopId),
      deliveredOrders: 0,
      deliveredAmount: 0,
      rtsOrders: 0,
      rtsAmount: 0,
      shippedOrders: 0,
      shippedAmount: 0,
      totalOrders: 0,
      totalAmount: 0,
    }));
  }, [chartShopOptions, displayChartShop, resolvedChartShops]);

  const totalRiskRows = riskRows.length;
  const totalRepurchaseRows = repurchaseRows.length;
  const totalStorePages = Math.max(1, Math.ceil(totalStoreRows / pageSize));
  const totalSummaryPages = Math.max(1, Math.ceil(totalSummaryRows / pageSize));
  const totalRiskPages = Math.max(1, Math.ceil(totalRiskRows / pageSize));
  const totalRepurchasePages = Math.max(1, Math.ceil(totalRepurchaseRows / pageSize));

  const pagedStoreRows = sortedStoreRows.slice((storePage - 1) * pageSize, storePage * pageSize);
  const pagedSummaryRows = sortedSummaryRows.slice((summaryPage - 1) * pageSize, summaryPage * pageSize);
  const pagedRiskRows = riskRows.slice((riskPage - 1) * pageSize, riskPage * pageSize);
  const pagedRepurchaseRows = repurchaseRows.slice(
    (repurchasePage - 1) * pageSize,
    repurchasePage * pageSize,
  );

  const storeStart = totalStoreRows === 0 ? 0 : (storePage - 1) * pageSize + 1;
  const storeEnd = Math.min(storePage * pageSize, totalStoreRows);
  const summaryStart = totalSummaryRows === 0 ? 0 : (summaryPage - 1) * pageSize + 1;
  const summaryEnd = Math.min(summaryPage * pageSize, totalSummaryRows);
  const riskStart = totalRiskRows === 0 ? 0 : (riskPage - 1) * pageSize + 1;
  const riskEnd = Math.min(riskPage * pageSize, totalRiskRows);
  const repurchaseStart = totalRepurchaseRows === 0 ? 0 : (repurchasePage - 1) * pageSize + 1;
  const repurchaseEnd = Math.min(repurchasePage * pageSize, totalRepurchaseRows);

  const storeCanPrev = storePage > 1;
  const storeCanNext = storePage < totalStorePages;
  const summaryCanPrev = summaryPage > 1;
  const summaryCanNext = summaryPage < totalSummaryPages;
  const riskCanPrev = riskPage > 1;
  const riskCanNext = riskPage < totalRiskPages;
  const repurchaseCanPrev = repurchasePage > 1;
  const repurchaseCanNext = repurchasePage < totalRepurchasePages;

  const activeRowCount = tableSelection === 'summary' ? totalSummaryRows : totalStoreRows;
  const selectedDeliveryViewLabel =
    deliveryViewOptions.find((opt) => opt.key === deliveryViewSelection)?.label ||
    'Delivery Monitoring';

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={
          <span className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">
            Analytics
          </span>
        }
        title="Sales Performance"
        description="Track performance by sales assignee and shop to understand upsell impact."
      />

      <DashboardSection
        title="Sales Performance Monitoring"
        icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />}
        meta={`Last updated: ${data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : '-'}`}
        className="panel panel-content"
        contentClassName="space-y-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsMultiSelectPicker
            className="relative"
            selectedLabel={selectedLabel}
            selectTitle="Select assignees"
            options={assigneePickerOptions}
            allChecked={isAllAssigneesMode}
            isChecked={(value) => resolvedSelection.includes(value)}
            onToggleAll={(checked) => {
              setIsAllAssigneesMode(checked);
              setSelectedAssignees([]);
            }}
            onToggle={toggleAssignee}
            onOnly={(value) => {
              setIsAllAssigneesMode(false);
              setSelectedAssignees([value]);
            }}
            onClear={() => {
              setIsAllAssigneesMode(true);
              setSelectedAssignees([]);
            }}
          />

          <div className="flex items-center gap-2">
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
                  salesPerformanceDateRangeIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
                }`}
                containerClassName=""
                popupClassName={(defaultClass: string) => `${defaultClass} z-50 kpi-datepicker-light`}
                displayFormat="MM/DD/YYYY"
                separator=" - "
                toggleIcon={() => (
                  <span className="flex w-full items-center gap-2 overflow-hidden">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span
                      className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                        salesPerformanceDateRangeIsToday
                          ? 'max-w-0 -translate-x-1 opacity-0'
                          : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                      }`}
                    >
                      {salesPerformanceDateRangeButtonLabel}
                    </span>
                  </span>
                )}
                toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
                placeholder=" "
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteError('');
                setShowDeleteModal(true);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300 hover:text-rose-700"
              aria-label="Delete POS orders in range"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: metricDefinitions.length }).map((_, idx) => (
                <AnalyticsMetricCardSkeleton key={idx} />
              ))
            : metrics.map((m) => {
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
                  <AnalyticsMetricCard
                    key={m.key}
                    label={m.label}
                    value={m.current}
                    format={m.format}
                    delta={m.delta}
                    count={
                      m.countKey
                        ? {
                            label: 'ord',
                            value: m.countCurrent ?? 0,
                            delta: m.countDelta ?? null,
                          }
                        : undefined
                    }
                    tooltip={tooltip}
                    tooltipMode="hover"
                  />
                );
              })}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Performance Breakdown"
        icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />}
        meta={`${activeRowCount || 0} rows`}
        className="panel panel-content"
        contentClassName="space-y-3"
      >
        <div className="flex items-center justify-between">
          <AnalyticsTableSelector
            className="relative"
            options={tableOptions}
            selectedKey={tableSelection}
            fallbackLabel="Sales Performance (Per Store)"
            onSelect={(key) => {
              setTableSelection(key);
              if (key === 'summary') {
                setSummaryPage(1);
              } else {
                setStorePage(1);
              }
            }}
          />
          <span className="text-xs text-slate-400">{activeRowCount || 0} rows</span>
        </div>

        {tableSelection === 'store' && (
          <AnalyticsSalesPerformanceStoreTable
            isLoading={isLoading}
            rows={pagedStoreRows}
            storeStart={storeStart}
            storeEnd={storeEnd}
            totalStoreRows={totalStoreRows}
            canPrevious={storeCanPrev}
            canNext={storeCanNext}
            onPrevious={() => setStorePage((p) => Math.max(1, p - 1))}
            onNext={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
            displayAssignee={displayAssignee}
            displayShop={displayShop}
            renderSortLabel={renderSortLabel}
          />
        )}

        {tableSelection === 'summary' && (
          <AnalyticsSalesPerformanceSummaryTable
            isLoading={isLoading}
            rows={pagedSummaryRows}
            summaryStart={summaryStart}
            summaryEnd={summaryEnd}
            totalSummaryRows={totalSummaryRows}
            canPrevious={summaryCanPrev}
            canNext={summaryCanNext}
            onPrevious={() => setSummaryPage((p) => Math.max(1, p - 1))}
            onNext={() => setSummaryPage((p) => Math.min(totalSummaryPages, p + 1))}
            displayAssignee={displayAssignee}
            renderSortLabel={renderSortLabel}
          />
        )}
      </DashboardSection>

      <DashboardSection
        title="Delivery Monitoring"
        icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />}
        className="panel panel-content"
        contentClassName="space-y-3"
        meta={
          <div className="relative" data-delivery-menu="true">
            <button
              type="button"
              onClick={() => setShowDeliveryViewMenu((p) => !p)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-orange-600"
            >
              {selectedDeliveryViewLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showDeliveryViewMenu && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {deliveryViewOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setDeliveryViewSelection(opt.key);
                      setShowDeliveryViewMenu(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm ${
                      deliveryViewSelection === opt.key
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-end gap-3">
            <AnalyticsMultiSelectPicker
              className="relative"
              selectedLabel={selectedChartShopLabel}
              selectTitle="Select shops"
              options={chartShopPickerOptions}
              allChecked={isAllChartShopsMode}
              isChecked={(value) => resolvedChartShops.includes(value)}
              onToggleAll={(checked) => {
                setIsAllChartShopsMode(checked);
                setSelectedChartShops([]);
              }}
              onToggle={toggleChartShop}
              onOnly={(value) => {
                setIsAllChartShopsMode(false);
                setSelectedChartShops([value]);
              }}
              onClear={() => {
                setIsAllChartShopsMode(true);
                setSelectedChartShops([]);
              }}
            />
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
                  salesPerformanceDateRangeIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
                }`}
                containerClassName=""
                popupClassName={(defaultClass: string) => `${defaultClass} z-50 kpi-datepicker-light`}
                displayFormat="MM/DD/YYYY"
                separator=" - "
                toggleIcon={() => (
                  <span className="flex w-full items-center gap-2 overflow-hidden">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span
                      className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                        salesPerformanceDateRangeIsToday
                          ? 'max-w-0 -translate-x-1 opacity-0'
                          : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                      }`}
                    >
                      {salesPerformanceDateRangeButtonLabel}
                    </span>
                  </span>
                )}
                toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
                placeholder=" "
              />
            </div>
          </div>
        <div className="p-1 sm:p-2">
          {deliveryViewSelection === 'risk_confirmation' ? (
            <AnalyticsRiskConfirmationTable
              isLoading={isProblematicLoading}
              rows={pagedRiskRows}
              riskStart={riskStart}
              riskEnd={riskEnd}
              totalRiskRows={totalRiskRows}
              canPrevious={riskCanPrev}
              canNext={riskCanNext}
              onPrevious={() => setRiskPage((p) => Math.max(1, p - 1))}
              onNext={() => setRiskPage((p) => Math.min(totalRiskPages, p + 1))}
            />
          ) : deliveryViewSelection === 'repurchase' ? (
            <AnalyticsSalesPerformanceRepurchaseTable
              isLoading={isProblematicLoading}
              rows={pagedRepurchaseRows}
              repurchaseStart={repurchaseStart}
              repurchaseEnd={repurchaseEnd}
              totalRepurchaseRows={totalRepurchaseRows}
              canPrevious={repurchaseCanPrev}
              canNext={repurchaseCanNext}
              onPrevious={() => setRepurchasePage((p) => Math.max(1, p - 1))}
              onNext={() =>
                setRepurchasePage((p) => Math.min(totalRepurchasePages, p + 1))
              }
            />
          ) : (
            <>
          <div className="mb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On Delivery</p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatCount(problematicData?.onDeliveryAllTime?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  COD: {formatCurrency(problematicData?.onDeliveryAllTime?.totalCod || 0)}
                </p>
              </div>
              {isProblematicLoading ? (
                <div className="h-[140px] w-full animate-pulse rounded-lg bg-slate-100" />
              ) : (problematicData?.onDeliveryTrend?.length || 0) > 0 ? (
                <ReactECharts option={onDeliverySparklineOption} style={{ height: 140 }} />
              ) : (
                <div className="h-[140px] w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-center text-xs text-slate-500">
                  No on-delivery trend data.
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Undeliverable</p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatCount(problematicData?.undeliverableAllTime?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  COD: {formatCurrency(problematicData?.undeliverableAllTime?.totalCod || 0)}
                </p>
              </div>
              {isProblematicLoading ? (
                <div className="h-[140px] w-full animate-pulse rounded-lg bg-slate-100" />
              ) : (problematicData?.undeliverableTrend?.length || 0) > 0 ? (
                <ReactECharts option={undeliverableSparklineOption} style={{ height: 140 }} />
              ) : (
                <div className="h-[140px] w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-center text-xs text-slate-500">
                  No undeliverable trend data.
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {deliveredInRangeLabel}
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatCount(problematicData?.deliveredInRange?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  COD: {formatCurrency(problematicData?.deliveredInRange?.totalCod || 0)}
                </p>
              </div>
              {isProblematicLoading ? (
                <div className="h-[140px] w-full animate-pulse rounded-lg bg-slate-100" />
              ) : (problematicData?.deliveredInRangeTrend?.length || 0) > 0 ? (
                <ReactECharts option={deliveredInRangeSparklineOption} style={{ height: 140 }} />
              ) : (
                <div className="h-[140px] w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-center text-xs text-slate-500">
                  No delivered trend data.
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {returnedInRangeLabel}
                </p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatCount(problematicData?.returnedInRange?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  COD: {formatCurrency(problematicData?.returnedInRange?.totalCod || 0)}
                </p>
              </div>
              {isProblematicLoading ? (
                <div className="h-[140px] w-full animate-pulse rounded-lg bg-slate-100" />
              ) : (problematicData?.returnedInRangeTrend?.length || 0) > 0 ? (
                <ReactECharts option={returnedInRangeSparklineOption} style={{ height: 140 }} />
              ) : (
                <div className="h-[140px] w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-center text-xs text-slate-500">
                  No returned trend data.
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-slate-50/40 p-2">
              <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">RTS Reason Data</p>
              {isProblematicLoading ? (
                <div className="h-[500px] w-full animate-pulse rounded-xl bg-slate-100" />
              ) : (problematicData?.data?.length || 0) > 0 ? (
                <>
                  <div className="px-2 pt-2 pb-1">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {sunburstLegend.map((item) => (
                        <div key={item.name} className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <span
                            className="h-4 w-8 flex-shrink-0 rounded-md"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <span className="tabular-nums text-slate-500">{formatCount(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ReactECharts option={chartOption} onEvents={sunburstEvents} style={{ height: 500 }} />
                  <div className="px-2 pt-2 pb-1">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 min-h-[84px]">
                      {sunburstHoverInfo ? (
                        <div className="space-y-1">
                          <div className="flex min-w-0 items-start gap-2">
                            <span
                              className="mt-1 h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: sunburstHoverInfo.color }}
                            />
                            <p
                              className="min-w-0 flex-1 text-sm font-medium text-slate-800 leading-5 whitespace-normal break-words"
                              title={sunburstHoverInfo.path}
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {sunburstHoverInfo.path}
                            </p>
                          </div>
                          <p className="text-xs text-slate-600">
                            Orders: <span className="font-semibold text-slate-900">{formatCount(sunburstHoverInfo.orders)}</span>{' '}
                            ({sunburstHoverInfo.pct.toFixed(1)}%)
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Hover a chart segment to inspect details.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-[500px] w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-center text-sm text-slate-500">
                  No problematic delivery data.
                </div>
              )}
            </div>
            <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50/40 p-2">
              <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Delivered vs RTS Trend</p>
              {isProblematicLoading ? (
                <div className="h-[500px] w-full animate-pulse rounded-xl bg-slate-100" />
              ) : (problematicData?.trend?.length || 0) > 0 ? (
                <ReactECharts option={trendLineOption} style={{ height: 500 }} />
              ) : (
                <div className="h-[500px] w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/40 flex items-center justify-center text-sm text-slate-500">
                  No trend data for the selected range.
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </DashboardSection>

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
            <AlertBanner tone="warning" message="This action cannot be undone." />
            <div>
              <span className="text-slate-500">Date range:</span>{' '}
              <span className="font-semibold text-slate-900">{rangeLabel}</span>
            </div>
          </div>

          {deleteError && (
            <AlertBanner tone="error" message={deleteError} />
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

