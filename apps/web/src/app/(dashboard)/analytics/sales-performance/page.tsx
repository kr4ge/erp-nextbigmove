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
import { BarChart3, CalendarDays, ChevronDown, Gauge, LineChart, Trash2 } from 'lucide-react';
import { AnalyticsMetricCard } from '../_components/analytics-metric-card';
import { AnalyticsMetricCardSkeleton } from '../_components/analytics-metric-card-skeleton';
import { AnalyticsMultiSelectPicker } from '../_components/analytics-multi-select-picker';
import { AnalyticsRiskConfirmationTable } from '../_components/analytics-risk-confirmation-table';
import {
  AnalyticsSalesPerformanceRepurchaseTable,
  type SalesPerformanceRepurchaseRow,
} from '../_components/analytics-sales-performance-repurchase-table';
import { AnalyticsSalesPerformanceStoreTable } from '../_components/analytics-sales-performance-store-table';
import { AnalyticsSortToggleLabel } from '../_components/analytics-sort-toggle-label';
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
  type SalesPerformanceStoreConversionResponse as OverviewResponse,
  type SalesPerformanceStoreConversionRow,
  type SalesPerformanceStoreConversionSortKey as SortKey,
  type SunburstHoverInfo,
  salesPerformanceMetricDefinitions as metricDefinitions,
} from '../_types/sales-performance';

const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);

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

type ChartPalette = {
  foreground: string;
  secondary: string;
  border: string;
  borderSoft: string;
};

const CHART_LIGHT: ChartPalette = {
  foreground: '#0f172a',
  secondary: 'rgba(15, 23, 42, 0.78)',
  border: '#cbd5e1',
  borderSoft: '#e2e8f0',
};

const CHART_DARK: ChartPalette = {
  foreground: '#f8fafc',
  secondary: 'rgba(248, 250, 252, 0.82)',
  border: '#475569',
  borderSoft: 'rgba(71, 85, 105, 0.45)',
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

const areArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
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
  const [deliveryViewSelection, setDeliveryViewSelection] =
    useState<'delivery' | 'risk_confirmation' | 'repurchase'>('delivery');
  const [showDeliveryViewMenu, setShowDeliveryViewMenu] = useState(false);
  const [storePage, setStorePage] = useState(1);
  const [riskPage, setRiskPage] = useState(1);
  const [repurchasePage, setRepurchasePage] = useState(1);
  const pageSize = 10;
  const [sortKey, setSortKey] = useState<SortKey>('abandoned_revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [problematicData, setProblematicData] = useState<ProblematicDeliveryResponse | null>(null);
  const [sunburstHoverInfo, setSunburstHoverInfo] = useState<SunburstHoverInfo | null>(null);
  const [isProblematicLoading, setIsProblematicLoading] = useState(false);
  const [isChartsDark, setIsChartsDark] = useState(false);
  const [performanceShopOptions, setPerformanceShopOptions] = useState<string[]>([]);
  const [chartShopOptions, setChartShopOptions] = useState<string[]>([]);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [hasInitializedChartShops, setHasInitializedChartShops] = useState(false);

  const lastSunburstHoverKeyRef = useRef<string>('');
  const { addToast } = useToast();

  const resolvedPerformanceShops = useMemo(
    () => (isAllShopsMode ? performanceShopOptions : selectedShops),
    [isAllShopsMode, selectedShops, performanceShopOptions],
  );

  const resolvedChartShops = useMemo(
    () => (isAllShopsMode ? chartShopOptions : selectedShops),
    [isAllShopsMode, selectedShops, chartShopOptions],
  );

  const selectedShopLabel =
    isAllShopsMode ? 'All shops' : `${selectedShops.length} selected`;
  const hasChartShopOptions = chartShopOptions.length > 0;

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
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const syncChartMode = () => {
      setIsChartsDark(root.classList.contains('dark'));
    };

    syncChartMode();

    const observer = new MutationObserver(() => {
      syncChartMode();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | string[]> = {
          start_date: startDate,
          end_date: endDate,
        };
        if (!isAllShopsMode) {
          params.shop_id =
            selectedShops.length > 0 ? selectedShops : ['__no_selection__'];
        }

        const res =
          await analyticsOverviewApi.getSalesPerformanceStoreConversion<OverviewResponse>(params);
        if (!isMounted) return;
        setData(res.data);
        const nextShops = res.data.filters.shops || [];
        setPerformanceShopOptions((prev) => (areArraysEqual(prev, nextShops) ? prev : nextShops));
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load sales performance store conversion', error);
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
    isAllShopsMode,
    refreshKey,
    selectedShops,
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
        if (!isAllShopsMode) {
          params.shop_id =
            selectedShops.length > 0 ? selectedShops : ['__no_selection__'];
        }

        const res = await analyticsOverviewApi.getProblematicDelivery<ProblematicDeliveryResponse>(
          params,
        );
        if (!isMounted) return;
        setProblematicData(res.data);
        const nextShops = res.data.filters.shops || [];
        setChartShopOptions((prev) => (areArraysEqual(prev, nextShops) ? prev : nextShops));
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
    isAllShopsMode,
    refreshKey,
    selectedShops,
    startDate,
  ]);

  useEffect(() => {
    if (isAllShopsMode) return;
    const allowed = new Set([...performanceShopOptions, ...chartShopOptions]);
    if (allowed.size === 0) {
      if (selectedShops.length > 0) {
        setSelectedShops([]);
      }
      setIsAllShopsMode(true);
      return;
    }

    const next = selectedShops.filter((shopId) => allowed.has(shopId));
    if (!areArraysEqual(selectedShops, next)) {
      setSelectedShops(next);
    }
    if (selectedShops.length > 0 && next.length === 0) {
      setIsAllShopsMode(true);
    }
  }, [chartShopOptions, isAllShopsMode, performanceShopOptions, selectedShops]);

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

  const displayShop = useCallback((value: string) => {
    return data?.filters?.shopDisplayMap?.[value] || value;
  }, [data?.filters?.shopDisplayMap]);

  const displayChartShop = useCallback((value: string) => {
    return problematicData?.filters?.shopDisplayMap?.[value] || data?.filters?.shopDisplayMap?.[value] || value;
  }, [data?.filters?.shopDisplayMap, problematicData?.filters?.shopDisplayMap]);

  const chartShopPickerOptions = chartShopOptions.map((value) => ({
    value,
    label: displayChartShop(value),
  }));

  const performanceShopPickerOptions = performanceShopOptions.map((value) => ({
    value,
    label: displayShop(value),
  }));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'shop' ? 'asc' : 'desc');
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

  const getSortValue = useCallback((row: SalesPerformanceStoreConversionRow, key: SortKey) => {
    switch (key) {
      case 'shop':
        return displayShop(row.shopId || '').toLowerCase();
      case 'abandoned_revenue':
        return row.abandonedConvertedRevenue;
      case 'abandoned_conversion':
        return row.abandonedConversionRatePct;
      case 'abandoned_delivery':
        return row.abandonedDeliveryRatePct;
      case 'abandoned_rts':
        return row.abandonedRtsRatePct;
      case 'repurchase_revenue':
        return row.repurchaseRevenue;
      case 'repurchase_conversion':
        return row.repurchaseConversionRatePct;
      case 'repurchase_delivery':
        return row.repurchaseDeliveryRatePct;
      case 'repurchase_rts':
        return row.repurchaseRtsRatePct;
      default:
        return 0;
    }
  }, [displayShop]);

  const toggleShop = (value: string, optionScope: string[]) => {
    if (isAllShopsMode) {
      setIsAllShopsMode(false);
      setSelectedShops(optionScope.filter((option) => option !== value));
      return;
    }
    const has = selectedShops.includes(value);
    const next = has
      ? selectedShops.filter((option) => option !== value)
      : [...selectedShops, value];
    if (optionScope.length > 0 && next.length === optionScope.length) {
      setIsAllShopsMode(true);
      setSelectedShops([]);
    } else {
      setSelectedShops(next);
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
    () => {
      const segmentBorder = isChartsDark ? '#0f172a' : '#ffffff';

      return {
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
              borderColor: segmentBorder,
              borderWidth: 2,
            },
            levels: [
              {},
              {
                r0: '8%',
                r: '24%',
                itemStyle: { borderColor: segmentBorder, borderWidth: 2 },
                label: { show: false },
              },
              {
                r0: '34%',
                r: '50%',
                itemStyle: { borderColor: segmentBorder, borderWidth: 2 },
                label: { show: false },
              },
              {
                r0: '60%',
                r: '76%',
                itemStyle: { borderColor: segmentBorder, borderWidth: 2 },
                label: { show: false },
              },
            ],
            emphasis: {
              focus: 'ancestor',
              itemStyle: {
                opacity: 1,
                borderColor: segmentBorder,
                borderWidth: 2,
              },
            },
            blur: {
              itemStyle: {
                opacity: 0.22,
                borderColor: segmentBorder,
                borderWidth: 2,
              },
            },
          },
        ],
      };
    },
    [isChartsDark, sunburstSeriesData],
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
    const palette = isChartsDark ? CHART_DARK : CHART_LIGHT;

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isChartsDark ? '#0f172a' : '#ffffff',
        borderColor: palette.border,
        borderWidth: 1,
        textStyle: { color: palette.foreground },
      },
      legend: {
        data: ['Delivered', 'RTS'],
        top: 6,
        left: 12,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: palette.secondary,
          fontSize: 11,
        },
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
        axisLine: { lineStyle: { color: palette.border } },
        axisTick: { show: false },
        axisLabel: { color: palette.secondary, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: { color: palette.borderSoft },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: palette.secondary, fontSize: 11 },
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
  }, [isChartsDark, trendChartData]);

  useEffect(() => {
    setStorePage(1);
  }, [data?.rows?.length]);

  useEffect(() => {
    setRiskPage(1);
  }, [problematicData?.riskConfirmationRows?.length, deliveryViewSelection]);

  useEffect(() => {
    setRepurchasePage(1);
  }, [deliveryViewSelection, resolvedChartShops, chartShopOptions]);

  useEffect(() => {
    setStorePage(1);
  }, [sortKey, sortDir]);

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
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (typeof av === 'string' || typeof bv === 'string') {
        return (sortDir === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv));
      }
      return (sortDir === 'asc' ? 1 : -1) * (Number(av) - Number(bv));
    });
  }, [data?.rows, getSortValue, sortKey, sortDir]);

  const totalStoreRows = sortedStoreRows.length;
  const riskRows = problematicData?.riskConfirmationRows || [];
  const repurchaseRows = useMemo<SalesPerformanceRepurchaseRow[]>(() => {
    return (problematicData?.repurchaseByShop || [])
      .map((row) => ({
        shop: displayChartShop(row.shopId),
        deliveredOrders: row.deliveredOrders || 0,
        deliveredAmount: row.deliveredAmount || 0,
        rtsOrders: row.rtsOrders || 0,
        rtsAmount: row.rtsAmount || 0,
        shippedOrders: row.shippedOrders || 0,
        shippedAmount: row.shippedAmount || 0,
        totalOrders: row.totalOrders || 0,
        totalAmount: row.totalAmount || 0,
      }))
      .filter(
        (row) =>
          row.deliveredOrders > 0 ||
          row.deliveredAmount > 0 ||
          row.rtsOrders > 0 ||
          row.rtsAmount > 0 ||
          row.shippedOrders > 0 ||
          row.shippedAmount > 0 ||
          row.totalOrders > 0 ||
          row.totalAmount > 0,
      );
  }, [displayChartShop, problematicData?.repurchaseByShop]);
  const repurchaseGrandTotals = useMemo(() => {
    return repurchaseRows.reduce(
      (acc, row) => {
        acc.deliveredOrders += row.deliveredOrders || 0;
        acc.deliveredAmount += row.deliveredAmount || 0;
        acc.rtsOrders += row.rtsOrders || 0;
        acc.rtsAmount += row.rtsAmount || 0;
        acc.shippedOrders += row.shippedOrders || 0;
        acc.shippedAmount += row.shippedAmount || 0;
        acc.totalOrders += row.totalOrders || 0;
        acc.totalAmount += row.totalAmount || 0;
        return acc;
      },
      {
        deliveredOrders: 0,
        deliveredAmount: 0,
        rtsOrders: 0,
        rtsAmount: 0,
        shippedOrders: 0,
        shippedAmount: 0,
        totalOrders: 0,
        totalAmount: 0,
      },
    );
  }, [repurchaseRows]);

  const totalRiskRows = riskRows.length;
  const totalRepurchaseRows = repurchaseRows.length;
  const totalStorePages = Math.max(1, Math.ceil(totalStoreRows / pageSize));
  const totalRiskPages = Math.max(1, Math.ceil(totalRiskRows / pageSize));
  const totalRepurchasePages = Math.max(1, Math.ceil(totalRepurchaseRows / pageSize));

  const pagedStoreRows = sortedStoreRows.slice((storePage - 1) * pageSize, storePage * pageSize);
  const pagedRiskRows = riskRows.slice((riskPage - 1) * pageSize, riskPage * pageSize);
  const pagedRepurchaseRows = repurchaseRows.slice(
    (repurchasePage - 1) * pageSize,
    repurchasePage * pageSize,
  );

  const storeStart = totalStoreRows === 0 ? 0 : (storePage - 1) * pageSize + 1;
  const storeEnd = Math.min(storePage * pageSize, totalStoreRows);
  const riskStart = totalRiskRows === 0 ? 0 : (riskPage - 1) * pageSize + 1;
  const riskEnd = Math.min(riskPage * pageSize, totalRiskRows);
  const repurchaseStart = totalRepurchaseRows === 0 ? 0 : (repurchasePage - 1) * pageSize + 1;
  const repurchaseEnd = Math.min(repurchasePage * pageSize, totalRepurchaseRows);

  const storeCanPrev = storePage > 1;
  const storeCanNext = storePage < totalStorePages;
  const riskCanPrev = riskPage > 1;
  const riskCanNext = riskPage < totalRiskPages;
  const repurchaseCanPrev = repurchasePage > 1;
  const repurchaseCanNext = repurchasePage < totalRepurchasePages;

  const activeRowCount = totalStoreRows;
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
        title="Sales Operations"
        description="Track abandoned-cart and repurchase conversion performance by store."
      />

      <DashboardSection
        title="Sales Performance Monitoring"
        icon={<Gauge className="panel-icon" />}
        meta={`Last updated: ${data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : '-'}`}
        className=""
        contentClassName="space-y-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsMultiSelectPicker
            className="relative"
            selectedLabel={selectedShopLabel}
            selectTitle="Select shops"
            options={performanceShopPickerOptions}
            allChecked={isAllShopsMode}
            isChecked={(value) => resolvedPerformanceShops.includes(value)}
            onToggleAll={(checked) => {
              setIsAllShopsMode(checked);
              setSelectedShops([]);
            }}
            onToggle={(value) => toggleShop(value, performanceShopOptions)}
            onOnly={(value) => {
              setIsAllShopsMode(false);
              setSelectedShops([value]);
            }}
            onClear={() => {
              setIsAllShopsMode(true);
              setSelectedShops([]);
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
                inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-border dark:!bg-transparent dark:!text-transparent transition-[width] duration-300 ease-out ${
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
                      className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out dark:text-foreground ${
                        salesPerformanceDateRangeIsToday
                          ? 'max-w-0 -translate-x-1 opacity-0'
                          : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                      }`}
                    >
                      {salesPerformanceDateRangeButtonLabel}
                    </span>
                  </span>
                )}
                toggleClassName="absolute inset-0 flex cursor-pointer items-center justify-start px-3 text-slate-600 dark:text-white hover:text-orange-700 dark:text-foreground"
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
                    tooltipMode="hover"
                  />
                );
              })}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Performance Breakdown"
        icon={<BarChart3 className="panel-icon" />}
        meta={`${activeRowCount || 0} rows`}
        className=""
        contentClassName="space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Store Conversion Breakdown</h3>
          <span className="text-xs text-slate-400">{activeRowCount || 0} rows</span>
        </div>

        <AnalyticsSalesPerformanceStoreTable
          isLoading={isLoading}
          rows={pagedStoreRows}
          storeStart={storeStart}
          storeEnd={storeEnd}
          totalStoreRows={totalStoreRows}
          currentPage={storePage}
          totalPages={totalStorePages}
          canPrevious={storeCanPrev}
          canNext={storeCanNext}
          onPrevious={() => setStorePage((p) => Math.max(1, p - 1))}
          onNext={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
          displayShop={displayShop}
          renderSortLabel={renderSortLabel}
        />
      </DashboardSection>

      <DashboardSection
        title="Delivery Monitoring"
        icon={<LineChart className="panel-icon" />}
        className=""
        contentClassName="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative" data-delivery-menu="true">
            <button
              type="button"
              onClick={() => setShowDeliveryViewMenu((p) => !p)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-foreground sm:text-lg"
            >
              <span className='whitespace-nowrap'>
                {selectedDeliveryViewLabel}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>
            {showDeliveryViewMenu && (
              <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-surface py-1 shadow-lg dark:border-border">
                {deliveryViewOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setDeliveryViewSelection(opt.key);
                      setShowDeliveryViewMenu(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm sm:text-base ${
                      deliveryViewSelection === opt.key
                        ? 'bg-slate-100 font-semibold text-foreground dark:bg-background-secondary'
                        : 'text-foreground hover:bg-slate-50 dark:bg-surface dark:hover:bg-background-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {deliveryViewSelection === 'repurchase' && !isProblematicLoading && !hasChartShopOptions ? (
              <p className="flex h-10 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-border dark:bg-background-secondary dark:text-slate-300">
                No shops to filter.
              </p>
            ) : (
              <AnalyticsMultiSelectPicker
                className="relative"
                selectedLabel={selectedShopLabel}
                selectTitle="Select shops"
                options={chartShopPickerOptions}
                allChecked={isAllShopsMode}
                isChecked={(value) => resolvedChartShops.includes(value)}
                onToggleAll={(checked) => {
                  setIsAllShopsMode(checked);
                  setSelectedShops([]);
                }}
                onToggle={(value) => toggleShop(value, chartShopOptions)}
                onOnly={(value) => {
                  setIsAllShopsMode(false);
                  setSelectedShops([value]);
                }}
                onClear={() => {
                  setIsAllShopsMode(true);
                  setSelectedShops([]);
                }}
              />
            )}
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
                inputClassName={`h-10 cursor-pointer rounded-xl border border-slate-200 bg-white p-0 text-transparent caret-transparent placeholder:text-transparent shadow-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 dark:!border-border dark:!bg-transparent dark:!text-transparent transition-[width] duration-300 ease-out ${
                  salesPerformanceDateRangeIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
                }`}
                containerClassName=""
                popupClassName={(defaultClass: string) => `${defaultClass} z-50 kpi-datepicker-light`}
                displayFormat="MM/DD/YYYY"
                separator=" - "
                toggleIcon={() => (
                  <span className="flex w-full items-center gap-2 overflow-hidden">
                    <CalendarDays className="h-4 w-4 shrink-0 text-white" />
                    <span
                      className={`whitespace-nowrap text-xs font-medium text-slate-700 dark:text-white transition-all duration-300 ease-out ${
                        salesPerformanceDateRangeIsToday
                          ? 'max-w-0 -translate-x-1 opacity-0'
                          : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                      }`}
                    >
                      {salesPerformanceDateRangeButtonLabel}
                    </span>
                  </span>
                )}
                toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 dark:text-white hover:text-orange-700 cursor-pointer"
                placeholder=" "
              />
            </div>
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
              currentPage={riskPage}
              totalPages={totalRiskPages}
              canPrevious={riskCanPrev}
              canNext={riskCanNext}
              onPrevious={() => setRiskPage((p) => Math.max(1, p - 1))}
              onNext={() => setRiskPage((p) => Math.min(totalRiskPages, p + 1))}
            />
          ) : deliveryViewSelection === 'repurchase' ? (
            <AnalyticsSalesPerformanceRepurchaseTable
              isLoading={isProblematicLoading}
              rows={pagedRepurchaseRows}
              grandTotals={repurchaseGrandTotals}
              repurchaseStart={repurchaseStart}
              repurchaseEnd={repurchaseEnd}
              totalRepurchaseRows={totalRepurchaseRows}
              currentPage={repurchasePage}
              totalPages={totalRepurchasePages}
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
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:bg-background-secondary dark:border-border">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">On Delivery</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCount(problematicData?.onDeliveryAllTime?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
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
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:bg-background-secondary dark:border-border">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Undeliverable</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCount(problematicData?.undeliverableAllTime?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
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
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:bg-background-secondary dark:border-border">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  {deliveredInRangeLabel}
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCount(problematicData?.deliveredInRange?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
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
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:bg-background-secondary dark:border-border">
              <div className="px-1 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  {returnedInRangeLabel}
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCount(problematicData?.returnedInRange?.count || 0)}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
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
            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:bg-background-secondary dark:border-border">
              <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">RTS Reason Data</p>
              {isProblematicLoading ? (
                <div className="h-[500px] w-full animate-pulse rounded-xl bg-slate-100 dark:bg-background-secondary" />
              ) : (problematicData?.data?.length || 0) > 0 ? (
                <>
                  <div className="px-2 pt-2 pb-1">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {sunburstLegend.map((item) => (
                        <div key={item.name} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-foreground">
                          <span
                            className="h-4 w-8 flex-shrink-0 rounded-md"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-slate-700 dark:text-foreground">{item.name}</span>
                          <span className="tabular-nums text-slate-500 dark:text-slate-300">{formatCount(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ReactECharts
                    key={`sales-problematic-sunburst-${isChartsDark ? 'dark' : 'light'}`}
                    option={chartOption}
                    onEvents={sunburstEvents}
                    style={{ height: 500 }}
                  />
                  <div className="px-2 pt-2 pb-1">
                    <div className="rounded-lg border border-slate-200 bg-surface px-3 py-2 min-h-[84px] dark:border-border">
                      {sunburstHoverInfo ? (
                        <div className="space-y-1">
                          <div className="flex min-w-0 items-start gap-2">
                            <span
                              className="mt-1 h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: sunburstHoverInfo.color }}
                            />
                            <p
                              className="min-w-0 flex-1 text-sm font-medium text-foreground leading-5 whitespace-normal break-words"
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
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Orders: <span className="font-semibold text-foreground">{formatCount(sunburstHoverInfo.orders)}</span>{' '}
                            ({sunburstHoverInfo.pct.toFixed(1)}%)
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Hover a chart segment to inspect details.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-[500px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
                  No problematic delivery data.
                </div>
              )}
            </div>
            <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:bg-background-secondary dark:border-border">
              <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Delivered vs RTS Trend</p>
              {isProblematicLoading ? (
                <div className="h-[500px] w-full animate-pulse rounded-xl bg-slate-100 dark:bg-surface" />
              ) : (problematicData?.trend?.length || 0) > 0 ? (
                <ReactECharts
                  key={`sales-problematic-trend-${isChartsDark ? 'dark' : 'light'}`}
                  option={trendLineOption}
                  style={{ height: 500 }}
                />
              ) : (
                <div className="flex h-[500px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500 dark:border-border dark:bg-surface dark:text-slate-300">
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
              <span className="font-semibold text-foreground">{rangeLabel}</span>
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
