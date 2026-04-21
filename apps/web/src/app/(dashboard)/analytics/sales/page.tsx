'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AlertBanner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import {
  BarChart3,
  CalendarDays,
  Columns,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  ShoppingBag,
  Share2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useToast } from '@/components/ui/toast';
import { DashboardSection } from '../../dashboard/_components/dashboard-section';
import { AnalyticsKpiVisibilityDialog } from '../_components/analytics-kpi-visibility-dialog';
import { AnalyticsMultiSelectPicker } from '../_components/analytics-multi-select-picker';
import { AnalyticsMetricCard } from '../_components/analytics-metric-card';
import { AnalyticsMetricCardSkeleton } from '../_components/analytics-metric-card-skeleton';
import {
  AnalyticsSalesDeliveryTable,
  type SalesDeliveryRowItem,
  type SalesDeliverySortKey,
} from '../_components/analytics-sales-delivery-table';
import {
  AnalyticsSalesProductsTable,
  type SalesProductRowItem,
  type SalesProductsSortKey,
} from '../_components/analytics-sales-products-table';
import { AnalyticsShareDialog } from '../_components/analytics-share-dialog';
import { AnalyticsSortDirectionLabel } from '../_components/analytics-sort-direction-label';
import {
  AnalyticsTableSelector,
  type AnalyticsTableSelectorOption,
} from '../_components/analytics-table-selector';
import { useAnalyticsDateRange } from '../_hooks/use-analytics-date-range';
import { useAnalyticsShare } from '../_hooks/use-analytics-share';
import { analyticsOverviewApi } from '../_services/analytics-overview-api';
import { useVisibleAutoRefresh } from '../_hooks/use-visible-auto-refresh';
import { useWorkflowTenantEvent } from '../_hooks/use-workflow-tenant-event';
import {
  type SalesOverviewResponse as OverviewResponse,
  salesMetricDefinitions as metricDefinitions,
  salesSecondaryMetricDefinitions as secondaryMetricDefinitions,
} from '../_types/sales';
import {
  formatDeltaPercent,
  formatMetricValue,
  toTitleCase,
} from '../_utils/metrics';
import {
  exportSalesProductsCsv,
  exportSalesProductsXlsx,
  type SalesProductsExportRow,
} from '../_utils/sales-products-export';
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

const KPI_VISIBILITY_STORAGE_KEY = 'sales-analytics-visible-kpis';
const DEFAULT_HIDDEN_KPI_KEYS = new Set([
  'cpp',
  'processed_cpp',
  'conversion_rate',
  'profit_efficiency',
  'contribution_margin',
]);
const DEFAULT_VISIBLE_KPI_KEYS = [
  ...metricDefinitions.map((def) => String(def.key)),
  ...secondaryMetricDefinitions.map((def) => String(def.key)),
].filter((key) => !DEFAULT_HIDDEN_KPI_KEYS.has(key));

function getSafeRtsForecastPct(pct: number) {
  return Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 20));
}

function computeCmRtsForecast(params: {
  revenueBase: number;
  adSpend: number;
  sf: number;
  ff: number;
  iF: number;
  codFeeDelivered: number;
  cogsAdjusted: number;
  cogsRts: number;
  rtsPct: number;
}) {
  const rtsFraction = getSafeRtsForecastPct(params.rtsPct) / 100;
  const revenueAfterRts = (1 - rtsFraction) * params.revenueBase;
  const cmForecast =
    revenueAfterRts -
    params.adSpend -
    params.sf -
    params.ff -
    params.iF -
    params.codFeeDelivered -
    params.cogsAdjusted +
    params.cogsRts;
  return { revenueAfterRts, cmForecast, rtsFraction };
}

function computeAdjustedCod(
  cod: number,
  canceled: number,
  restocking: number,
  abandoned: number,
  opts: { excludeCancel: boolean; excludeRestocking: boolean; excludeAbandoned: boolean },
) {
  return (
    cod -
    (opts.excludeCancel ? canceled : 0) -
    (opts.excludeRestocking ? restocking : 0) -
    (opts.excludeAbandoned ? abandoned : 0)
  );
}

function computeAdjustedGrossCod(
  kpis: OverviewResponse['kpis'],
  opts: { excludeCancel: boolean; excludeRestocking: boolean; excludeAbandoned: boolean },
) {
  return computeAdjustedCod(
    kpis.gross_cod ?? 0,
    kpis.canceled_cod ?? 0,
    kpis.restocking_cod ?? 0,
    kpis.abandoned_cod ?? 0,
    opts,
  );
}

function computeRtsPctFromCounts(counts?: OverviewResponse['counts'] | null) {
  if (!counts) return 0;
  const delivered = counts.delivered ?? 0;
  const rts = counts.rts ?? 0;
  const total = delivered + rts;
  return total > 0 ? (rts / total) * 100 : 0;
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const maybeError = error as {
    response?: { data?: { message?: unknown } };
    message?: unknown;
  };
  const responseMessage = maybeError.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) return responseMessage;
  if (typeof maybeError.message === 'string' && maybeError.message.trim().length > 0) return maybeError.message;
  return fallback;
}

function areArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areRecordsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export default function SalesAnalyticsPage() {
  const { today, range, startDate, endDate, handleDateRangeChange, syncDateRangeFromApi } =
    useAnalyticsDateRange();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMappings, setSelectedMappings] = useState<string[]>([]);
  const [mappingOptions, setMappingOptions] = useState<string[]>([]);
  const [mappingDisplayMap, setMappingDisplayMap] = useState<Record<string, string>>({});
  const mappingOptionsRef = useRef<string[]>([]);
  const selectedMappingsRef = useRef<string[]>([]);
  const [excludeCanceled, setExcludeCanceled] = useState(true);
  const [excludeRestocking, setExcludeRestocking] = useState(true);
  const [excludeAbandoned, setExcludeAbandoned] = useState(true);
  const [excludeRts, setExcludeRts] = useState(true);
  const [includeTax12, setIncludeTax12] = useState(true);
  const [includeTax1, setIncludeTax1] = useState(true);
  const [rtsForecastPct, setRtsForecastPct] = useState<number>(20);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterMenuContentRef = useRef<HTMLDivElement | null>(null);
  const fetchDataRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showKpiVisibilityModal, setShowKpiVisibilityModal] = useState(false);
  const [visibleKpiKeys, setVisibleKpiKeys] = useState<string[]>(
    DEFAULT_VISIBLE_KPI_KEYS,
  );
  const [hasLoadedKpiVisibility, setHasLoadedKpiVisibility] = useState(false);
  const pageSize = 10;
  const [tableSelection, setTableSelection] = useState<'products' | 'delivery'>('products');
  const [productPage, setProductPage] = useState(1);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [isReconciling, setIsReconciling] = useState(false);
  const {
    canShare,
    currentTeamId,
    openShareModal,
    saveShare,
    setShareOpen,
    shareLoading,
    shareOpen,
    shareSaving,
    shareSelected,
    shareTeams,
    toggleShareTeam,
  } = useAnalyticsShare('sales');
  const { addToast } = useToast();
  const rtsForecastSafe = getSafeRtsForecastPct(rtsForecastPct);
  const [sortKey, setSortKey] = useState<SalesProductsSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deliverySortKey, setDeliverySortKey] = useState<SalesDeliverySortKey | null>(null);
  const [deliverySortDir, setDeliverySortDir] = useState<'asc' | 'desc'>('desc');
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const salesDateRangeIsToday = startDate === today && endDate === today;
  const formatDateRangeButtonDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  };
  const salesDateRangeButtonLabel =
    startDate === endDate
      ? formatDateRangeButtonDate(startDate)
      : `${formatDateRangeButtonDate(startDate)} - ${formatDateRangeButtonDate(endDate)}`;

  useEffect(() => {
    mappingOptionsRef.current = mappingOptions;
  }, [mappingOptions]);

  useEffect(() => {
    selectedMappingsRef.current = selectedMappings;
  }, [selectedMappings]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem(KPI_VISIBILITY_STORAGE_KEY);
      if (!stored) {
        setHasLoadedKpiVisibility(true);
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setHasLoadedKpiVisibility(true);
        return;
      }

      const next = parsed
        .map((value) => String(value))
        .filter((value) => DEFAULT_VISIBLE_KPI_KEYS.includes(value));

      setVisibleKpiKeys(next.length > 0 ? next : DEFAULT_VISIBLE_KPI_KEYS);
    } catch {
      setVisibleKpiKeys(DEFAULT_VISIBLE_KPI_KEYS);
    } finally {
      setHasLoadedKpiVisibility(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedKpiVisibility || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      KPI_VISIBILITY_STORAGE_KEY,
      JSON.stringify(visibleKpiKeys),
    );
  }, [hasLoadedKpiVisibility, visibleKpiKeys]);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError(null);
    try {
      const currentOptions = mappingOptionsRef.current;
      const currentSelected = selectedMappingsRef.current;
      const normalizedOptions = currentOptions.map((m) => m.toLowerCase());
      const allPreviouslySelected =
        normalizedOptions.length === 0
          ? currentSelected.length === 0
          : currentSelected.length === 0 ||
            (currentSelected.length === normalizedOptions.length &&
              normalizedOptions.every((m) => currentSelected.includes(m)));
      const effectiveSel = allPreviouslySelected ? normalizedOptions : currentSelected;
      const sendAll = allPreviouslySelected || effectiveSel.length === normalizedOptions.length;
      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (!sendAll && effectiveSel.length > 0) {
        effectiveSel.forEach((m) => params.append('mapping', m));
      }
      params.set('exclude_cancel', String(excludeCanceled));
      params.set('exclude_restocking', String(excludeRestocking));
      params.set('exclude_abandoned', String(excludeAbandoned));
      params.set('exclude_rts', String(excludeRts));
      params.set('include_tax_12', String(includeTax12));
      params.set('include_tax_1', String(includeTax1));
      const res = await analyticsOverviewApi.getSalesOverview<OverviewResponse>(params);
      setData(res.data);
      const optsList = res.data.filters.mappings || [];
      const normalized = optsList.map((m) => m.toLowerCase());
      setMappingOptions((prev) => (areArraysEqual(prev, normalized) ? prev : normalized));
      const nextDisplayMap = res.data.filters.mappingsDisplayMap || {};
      setMappingDisplayMap((prev) => (areRecordsEqual(prev, nextDisplayMap) ? prev : nextDisplayMap));
      if (allPreviouslySelected) {
        setSelectedMappings((prev) => (areArraysEqual(prev, normalized) ? prev : normalized));
      } else {
        const bounded = currentSelected.filter((m) => normalized.includes(m));
        setSelectedMappings((prev) => (areArraysEqual(prev, bounded) ? prev : bounded));
      }
      syncDateRangeFromApi(res.data.selected.start_date, res.data.selected.end_date);
    } catch (error: unknown) {
      setError(parseErrorMessage(error, 'Failed to load sales overview'));
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [
    endDate,
    excludeAbandoned,
    excludeCanceled,
    excludeRestocking,
    excludeRts,
    includeTax1,
    includeTax12,
    startDate,
    syncDateRangeFromApi,
  ]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  const reconcileRange = async () => {
    if (!startDate || !endDate) return;
    setIsReconciling(true);
    setError(null);
    try {
      const res = await apiClient.post('/analytics/sales/reconcile', {
        start_date: startDate,
        end_date: endDate,
      });
      const errors = res?.data?.errors || [];
      if (errors.length > 0) {
        addToast('error', `Reconcile completed with ${errors.length} error${errors.length > 1 ? 's' : ''}`);
      } else {
        addToast('success', 'Reconcile completed successfully');
      }
      await fetchData({ silent: true });
    } catch (error: unknown) {
      const message = parseErrorMessage(error, 'Failed to reconcile sales data');
      setError(message);
      addToast('error', message);
    } finally {
      setIsReconciling(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [fetchData, selectedMappings]);

  useVisibleAutoRefresh(() => {
    void fetchData({ silent: true });
  });

  // Realtime refetch on marketing update events (reconcile_sales emits marketing:updated)
  useWorkflowTenantEvent('marketing:updated', () => {
    fetchDataRef.current?.({ silent: true });
  });

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      const inFilter = filterMenuRef.current?.contains(target) || filterMenuContentRef.current?.contains(target);
      if (showFilterMenu && !inFilter) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  const mappingDisplay = (val: string) => mappingDisplayMap[val.toLowerCase()] || val;
  const mappingPickerOptions = mappingOptions.map((mapping) => ({
    value: mapping,
    label: toTitleCase(mappingDisplay(mapping)),
  }));
  const selectedMappingLabel =
    selectedMappings.length === mappingOptions.length
      ? 'All mappings'
      : `${selectedMappings.length} selected`;
  const isChecked = (norm: string) => selectedMappings.includes(norm);
  const setSort = (key: NonNullable<typeof sortKey>, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };
  const setDeliverySort = (key: NonNullable<typeof deliverySortKey>, dir: 'asc' | 'desc') => {
    setDeliverySortKey(key);
    setDeliverySortDir(dir);
  };
  const renderSortLabel = (label: ReactNode, key: NonNullable<typeof sortKey>) => (
    <AnalyticsSortDirectionLabel
      label={label}
      activeDirection={sortKey === key ? sortDir : null}
      onSort={(dir) => setSort(key, dir)}
      ariaLabel={String(label)}
    />
  );

  const renderDeliverySortLabel = (label: ReactNode, key: NonNullable<typeof deliverySortKey>) => (
    <AnalyticsSortDirectionLabel
      label={label}
      activeDirection={deliverySortKey === key ? deliverySortDir : null}
      onSort={(dir) => setDeliverySort(key, dir)}
      ariaLabel={String(label)}
    />
  );

  const computedKpis = data
    ? (() => {
        const adjustedGrossCod = computeAdjustedGrossCod(data.kpis, {
          excludeCancel: excludeCanceled,
          excludeRestocking: excludeRestocking,
          excludeAbandoned,
        });
        const purchasesForCmRts =
          (data.counts.purchases ?? 0) + (excludeRts ? data.counts.rts ?? 0 : 0);
        const aovForCmRts = purchasesForCmRts > 0 ? adjustedGrossCod / purchasesForCmRts : 0;
        const revenueBaseForCmRts = aovForCmRts * purchasesForCmRts;
        const cogsTotal = data.kpis.cogs ?? 0;
        const cogsCanceled = excludeCanceled ? data.kpis.cogs_canceled ?? 0 : 0;
        const cogsRestocking = excludeRestocking ? data.kpis.cogs_restocking ?? 0 : 0;
        const cogsAdjusted = cogsTotal - cogsCanceled - cogsRestocking;
        return {
          ...data.kpis,
          rts_pct: computeRtsPctFromCounts(data.counts),
          cm_rts_forecast: computeCmRtsForecast({
            revenueBase: revenueBaseForCmRts,
            adSpend: data.kpis.ad_spend ?? 0,
            sf: data.kpis.sf_fees ?? 0,
            ff: data.kpis.ff_fees ?? 0,
            iF: data.kpis.if_fees ?? 0,
            codFeeDelivered: data.kpis.cod_fee_delivered ?? 0,
            cogsAdjusted,
            cogsRts: data.kpis.cogs_rts ?? 0,
            rtsPct: rtsForecastSafe,
          }).cmForecast,
        };
      })()
    : null;
  const computedPrevKpis = data
    ? (() => {
        const adjustedGrossCod = computeAdjustedGrossCod(data.prevKpis, {
          excludeCancel: excludeCanceled,
          excludeRestocking: excludeRestocking,
          excludeAbandoned,
        });
        const purchasesForCmRts =
          (data.prevCounts.purchases ?? 0) + (excludeRts ? data.prevCounts.rts ?? 0 : 0);
        const aovForCmRts = purchasesForCmRts > 0 ? adjustedGrossCod / purchasesForCmRts : 0;
        const revenueBaseForCmRts = aovForCmRts * purchasesForCmRts;
        const cogsTotal = data.prevKpis.cogs ?? 0;
        const cogsCanceled = excludeCanceled ? data.prevKpis.cogs_canceled ?? 0 : 0;
        const cogsRestocking = excludeRestocking ? data.prevKpis.cogs_restocking ?? 0 : 0;
        const cogsAdjusted = cogsTotal - cogsCanceled - cogsRestocking;
        return {
          ...data.prevKpis,
          rts_pct: computeRtsPctFromCounts(data.prevCounts),
          cm_rts_forecast: computeCmRtsForecast({
            revenueBase: revenueBaseForCmRts,
            adSpend: data.prevKpis.ad_spend ?? 0,
            sf: data.prevKpis.sf_fees ?? 0,
            ff: data.prevKpis.ff_fees ?? 0,
            iF: data.prevKpis.if_fees ?? 0,
            codFeeDelivered: data.prevKpis.cod_fee_delivered ?? 0,
            cogsAdjusted,
            cogsRts: data.prevKpis.cogs_rts ?? 0,
            rtsPct: rtsForecastSafe,
          }).cmForecast,
        };
      })()
    : null;

  const products = data?.products || [];
  const sortableProducts: SalesProductRowItem[] = products.map((row, index) => {
    const norm = (row.mapping || '__null__').toLowerCase();
    const display = row.mapping ? (mappingDisplayMap[norm] || row.mapping) : 'Unassigned';
    const baseCod = row.cod_raw ?? row.revenue ?? 0;
    const canceledCod = row.canceled_cod ?? 0;
    const restockingCod = row.restocking_cod ?? 0;
    const abandonedCod = row.abandoned_cod ?? 0;
    const adjustedGrossCod = Math.max(
      0,
      computeAdjustedCod(baseCod, canceledCod, restockingCod, abandonedCod, {
        excludeCancel: excludeCanceled,
        excludeRestocking: excludeRestocking,
        excludeAbandoned,
      }),
    );
    const purchasesForCmRts =
      (row.gross_sales ?? 0) + (excludeRts ? row.rts_count ?? 0 : 0);
    const aovForCmRts = purchasesForCmRts > 0 ? adjustedGrossCod / purchasesForCmRts : 0;
    const revenueBaseForCmRts = aovForCmRts * purchasesForCmRts;
    const sf = row.sf_raw ?? row.sf_fees ?? 0;
    const ff = row.ff_raw ?? row.ff_fees ?? 0;
    const iF = row.if_raw ?? row.if_fees ?? 0;
    const codFeeDelivered = row.cod_fee_delivered_raw ?? row.cod_fee_delivered ?? 0;
    const cogsBase = row.cogs ?? 0;
    const cogsCanceled = row.cogs_ec != null ? Math.max(0, cogsBase - row.cogs_ec) : 0;
    const cogsRestocking = row.cogs_restocking ?? 0;
    const cogsRts = row.cogs_rts ?? 0;
    // row.cogs already respects excludeCanceled/excludeRestocking; RTS is not removed in backend
    const cogsAdjusted = cogsBase;
    const forecast = computeCmRtsForecast({
      revenueBase: revenueBaseForCmRts,
      adSpend: row.ad_spend ?? 0,
      sf,
      ff,
      iF,
      codFeeDelivered,
      cogsAdjusted,
      cogsRts,
      rtsPct: rtsForecastSafe,
    });
    const deliveredCount = row.delivered_count ?? 0;
    const rtsCount = row.rts_count ?? 0;
    const rtsPct = deliveredCount + rtsCount > 0 ? (rtsCount / (deliveredCount + rtsCount)) * 100 : 0;
    return {
      row,
      index,
      derived: {
        display,
        forecast,
        rtsPct,
        sf,
        ff,
        iF,
        codFeeDelivered,
        cogsAdjusted,
        cogsRts,
        cogsCanceled,
        cogsRestocking,
      },
    };
  });

  const sortedProducts = sortKey
    ? [...sortableProducts].sort((a, b) => {
        const getValue = (item: typeof a) => {
          const r = item.row;
          switch (sortKey) {
            case 'index':
              return item.index;
            case 'product':
              return item.derived.display.toLowerCase();
            case 'revenue':
              return r.revenue ?? 0;
            case 'gross_sales':
              return r.gross_sales ?? 0;
            case 'cogs':
              return r.cogs ?? 0;
            case 'aov':
              return r.aov ?? 0;
            case 'cpp':
              return r.cpp ?? 0;
            case 'processed_cpp':
              return r.processed_cpp ?? 0;
            case 'ad_spend':
              return r.ad_spend ?? 0;
            case 'ar_pct':
              return r.ar_pct ?? 0;
            case 'rts_pct':
              return item.derived.rtsPct ?? 0;
            case 'profit_efficiency':
              return r.profit_efficiency ?? 0;
            case 'contribution_margin':
              return r.contribution_margin ?? 0;
            case 'cm_rts_forecast':
              return item.derived.forecast.cmForecast ?? 0;
            case 'net_margin':
              return r.net_margin ?? 0;
            default:
              return 0;
          }
        };
        const av = getValue(a);
        const bv = getValue(b);
        if (typeof av === 'string' || typeof bv === 'string') {
          const aStr = String(av);
          const bStr = String(bv);
          return (sortDir === 'asc' ? 1 : -1) * aStr.localeCompare(bStr);
        }
        return (sortDir === 'asc' ? 1 : -1) * (Number(av) - Number(bv));
      })
    : sortableProducts;

  const totalProducts = sortedProducts.length;
  const totalProductPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const pagedProducts = sortedProducts.slice((productPage - 1) * pageSize, productPage * pageSize);
  const productStart = totalProducts === 0 ? 0 : (productPage - 1) * pageSize + 1;
  const productEnd = Math.min(productPage * pageSize, totalProducts);
  const productCanPrev = productPage > 1;
  const productCanNext = productPage < totalProductPages;
  const cmRtsExportLabel = `CM (RTS ${rtsForecastSafe}%)`;
  const exportableProducts: SalesProductsExportRow[] = sortedProducts
    .filter((item) => {
      const adSpend = item.row.ad_spend ?? 0;
      if (adSpend !== 0) return true;
      const revenue = item.row.revenue ?? 0;
      return revenue !== 0;
    })
    .map((item) => ({
      product: toTitleCase(item.derived.display),
      grossRevenue: item.row.revenue ?? 0,
      grossSales: item.row.gross_sales ?? 0,
      cogs: item.row.cogs ?? 0,
      aov: item.row.aov ?? 0,
      cpp: item.row.cpp ?? 0,
      processedCpp: item.row.processed_cpp ?? 0,
      adSpend: item.row.ad_spend ?? 0,
      arPct: item.row.ar_pct ?? 0,
      rtsPct: item.derived.rtsPct ?? 0,
      pePct: item.row.profit_efficiency ?? 0,
      contributionMargin: item.row.contribution_margin ?? 0,
      cmRtsForecast: item.derived.forecast.cmForecast ?? 0,
      netMargin: item.row.net_margin ?? 0,
    }));

  const handleExportProductsCsv = async () => {
    if (isLoading || exportableProducts.length === 0) return;
    setIsExportingCsv(true);
    try {
      exportSalesProductsCsv({
        startDate,
        endDate,
        cmRtsLabel: cmRtsExportLabel,
        rows: exportableProducts,
      });
      addToast('success', 'CSV export generated.');
    } catch (err) {
      console.error('Failed to export Sales Analytics CSV', err);
      addToast('error', 'Failed to export CSV report.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportProductsXlsx = async () => {
    if (isLoading || exportableProducts.length === 0) return;
    setIsExportingXlsx(true);
    try {
      await exportSalesProductsXlsx({
        startDate,
        endDate,
        cmRtsLabel: cmRtsExportLabel,
        rows: exportableProducts,
      });
      addToast('success', 'XLSX export generated.');
    } catch (err) {
      console.error('Failed to export Sales Analytics XLSX', err);
      addToast('error', 'Failed to export XLSX report.');
    } finally {
      setIsExportingXlsx(false);
    }
  };

  const deliveryStatuses = data?.deliveryStatuses || [];
  const deliveryRows: SalesDeliveryRowItem[] = deliveryStatuses.map((row, index) => {
    const norm = (row.mapping || '__null__').toLowerCase();
    const display = row.mapping ? (mappingDisplayMap[norm] || row.mapping) : 'Unassigned';
    return {
      row,
      index,
      display,
    };
  });

  const sortedDeliveryRows = deliverySortKey
    ? [...deliveryRows].sort((a, b) => {
        const getValue = (item: typeof a) => {
          switch (deliverySortKey) {
            case 'index':
              return item.index;
            case 'product':
              return item.display.toLowerCase();
            case 'total_orders':
              return item.row.total_orders ?? 0;
            case 'new_orders':
              return item.row.new_orders ?? 0;
            case 'restocking':
              return item.row.restocking ?? 0;
            case 'confirmed':
              return item.row.confirmed ?? 0;
            case 'printed':
              return item.row.printed ?? 0;
            case 'waiting_pickup':
              return item.row.waiting_pickup ?? 0;
            case 'shipped':
              return item.row.shipped ?? 0;
            case 'delivered':
              return item.row.delivered ?? 0;
            case 'rts':
              return item.row.rts ?? 0;
            case 'canceled':
              return item.row.canceled ?? 0;
            case 'deleted':
              return item.row.deleted ?? 0;
            default:
              return 0;
          }
        };
        const av = getValue(a);
        const bv = getValue(b);
        if (typeof av === 'string' || typeof bv === 'string') {
          return (deliverySortDir === 'asc' ? 1 : -1) * String(av).localeCompare(String(bv));
        }
        return (deliverySortDir === 'asc' ? 1 : -1) * (Number(av) - Number(bv));
      })
    : deliveryRows;

  const totalDelivery = sortedDeliveryRows.length;
  const totalDeliveryPages = Math.max(1, Math.ceil(totalDelivery / pageSize));
  const pagedDeliveryRows = sortedDeliveryRows.slice((deliveryPage - 1) * pageSize, deliveryPage * pageSize);
  const deliveryStart = totalDelivery === 0 ? 0 : (deliveryPage - 1) * pageSize + 1;
  const deliveryEnd = Math.min(deliveryPage * pageSize, totalDelivery);
  const deliveryCanPrev = deliveryPage > 1;
  const deliveryCanNext = deliveryPage < totalDeliveryPages;

  const metricValues = data
    ? metricDefinitions.map((def) => {
        const current = computedKpis?.[def.key] ?? 0;
        const previous = computedPrevKpis?.[def.key] ?? 0;
        const delta = formatDeltaPercent(current, previous);
        const countCurrent = def.countKey ? data.counts?.[def.countKey] ?? 0 : null;
        const countPrev = def.countKey ? data.prevCounts?.[def.countKey] ?? 0 : null;
        const countDelta = def.countKey ? formatDeltaPercent(countCurrent ?? 0, countPrev ?? 0) : null;
        return { ...def, current, previous, delta, countCurrent, countPrev, countDelta };
      })
    : [];
  const visibleMetricValues = metricValues.filter((metric) =>
    visibleKpiKeys.includes(String(metric.key)),
  );

  const tableOptions: AnalyticsTableSelectorOption<'products' | 'delivery'>[] = [
    { key: 'products', label: 'Revenue per Product' },
    { key: 'delivery', label: 'Delivery Status' },
  ];

  const leftCard = visibleMetricValues.find((m) => m.key === 'revenue');
  const rightCard = visibleMetricValues.find((m) => m.key === 'ad_spend');
  const middleCards = visibleMetricValues.filter(
    (m) => m.key !== 'revenue' && m.key !== 'ad_spend',
  );

  const secondaryCards =
    data
      ? secondaryMetricDefinitions.map((def) => {
          const current = computedKpis?.[def.key] ?? 0;
          const previous = computedPrevKpis?.[def.key] ?? 0;
          const delta = formatDeltaPercent(current, previous);
          const label =
            def.key === 'cm_rts_forecast'
              ? `CM (RTS ${rtsForecastSafe}% )`
              : def.label;
          return {
            key: def.key,
            label,
            format: def.format,
            current,
            previous,
            delta,
            countCurrent: null,
            countPrev: null,
            countDelta: null,
          };
        })
      : [];
  const visibleSecondaryCards = secondaryCards.filter((metric) =>
    visibleKpiKeys.includes(String(metric.key)),
  );
  const leftSecondary = visibleSecondaryCards.find((m) => m.key === 'cm_rts_forecast');
  const fixedRightSecondary = visibleSecondaryCards.filter(
    (m) => m.key === 'net_margin',
  );
  const middleSecondary = visibleSecondaryCards.filter(
    (m) =>
      m.key !== 'cm_rts_forecast' &&
      m.key !== 'net_margin',
  );
  const kpiVisibilityOptions = [
    ...metricDefinitions.map((metric) => ({
      key: String(metric.key),
      label: metric.label,
      section: 'Primary' as const,
    })),
    ...secondaryMetricDefinitions.map((metric) => ({
      key: String(metric.key),
      label: metric.label,
      section: 'Secondary' as const,
    })),
  ];

  const buildCmTooltip = (kpis: OverviewResponse['kpis'] | undefined): ReactNode | null => {
    if (!kpis) return null;
    const nf = (v: number) => formatMetricValue(v, 'currency');
    const neg = (v: number) => (v === 0 ? nf(0) : `- ${nf(Math.abs(v))}`);
    const pos = (v: number) => (v === 0 ? nf(0) : `+ ${nf(Math.abs(v))}`);
    const fulfillment = (kpis.sf_fees ?? 0) + (kpis.ff_fees ?? 0) + (kpis.if_fees ?? 0);
    const canceledCodAdj = excludeCanceled ? kpis.canceled_cod ?? 0 : 0;
    const restockingCodAdj = excludeRestocking ? kpis.restocking_cod ?? 0 : 0;
    const rtsCodAdj = excludeRts ? kpis.rts_cod ?? 0 : 0;
    const excludedCogsCanceled = excludeCanceled ? kpis.cogs_canceled ?? 0 : 0;
    const excludedCogsRestocking = excludeRestocking ? kpis.cogs_restocking ?? 0 : 0;
    const cogsRaw = kpis.cogs ?? 0;
    const cogsIncluded =
      cogsRaw - excludedCogsCanceled - excludedCogsRestocking;
    const filtersLabel = [
      `${startDate} → ${endDate}`,
      `${selectedMappings.length || 0}/${mappingOptions.length || 0} mappings`,
      `Exclude: cancel ${excludeCanceled ? 'ON' : 'OFF'}, restocking ${excludeRestocking ? 'ON' : 'OFF'}, abandoned ${excludeAbandoned ? 'ON' : 'OFF'}, RTS ${excludeRts ? 'ON' : 'OFF'}`,
    ].join(' • ');

    return (
      <div className="space-y-1">
        <p className="font-semibold text-slate-800">Contribution Margin inputs</p>
        <div className="flex justify-between text-slate-800">
          <span>Gross COD</span>
          <span>{nf(kpis.gross_cod ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span className="flex items-center gap-1">
            Canceled COD
          </span>
          <span>{neg(canceledCodAdj)}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span className="flex items-center gap-1">
            Restocking COD
          </span>
          <span>{neg(restockingCodAdj)}</span>
        </div>
        <div className="flex justify-between text-slate-700">
          <span className="flex items-center gap-1">
            RTS COD
          </span>
          <span>{neg(rtsCodAdj)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>Revenue after adjustments</span>
          <span>{nf(kpis.revenue ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>Fulfillment (SF+FF+IF)</span>
          <span>{neg(fulfillment)}</span>
        </div>
        <div className="flex justify-between text-slate-600 text-xs">
          <span>SF Fees</span>
          <span>{neg(kpis.sf_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-600 text-xs">
          <span>FF Fees</span>
          <span>{neg(kpis.ff_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-600 text-xs">
          <span>IF Fees</span>
          <span>{neg(kpis.if_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>COD Fee</span>
          <span>{neg(kpis.cod_fee ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>Ad Spend</span>
          <span>{neg(kpis.ad_spend ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COGS (raw)</span>
          <span>{neg(cogsRaw)}</span>
        </div>
        <div className="flex justify-between text-slate-700 text-[12px]">
          <span>- COGS Canceled</span>
          <span>{pos(excludedCogsCanceled)}</span>
        </div>
        <div className="flex justify-between text-slate-700 text-[12px]">
          <span>- COGS Restocking</span>
          <span>{pos(excludedCogsRestocking)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>COGS used in CM</span>
          <span>{neg(cogsIncluded)}</span>
        </div>
        <div className="flex justify-between text-slate-700 text-[12px]">
          <span>+ RTS COGS</span>
          <span>{pos(kpis.cogs_rts ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-semibold">
          <span>Contribution Margin</span>
          <span>{nf(kpis.contribution_margin ?? 0)}</span>
        </div>
        <p className="text-xs text-slate-500">{filtersLabel}</p>
      </div>
    );
  };

  const buildNmTooltip = (kpis: OverviewResponse['kpis'] | undefined): ReactNode | null => {
    if (!kpis) return null;
    const nf = (v: number) => formatMetricValue(v, 'currency');
    const neg = (v: number) => (v === 0 ? nf(0) : `- ${nf(Math.abs(v))}`);
    const filtersLabel = [
      `${startDate} → ${endDate}`,
      `${selectedMappings.length || 0}/${mappingOptions.length || 0} mappings`,
      `Exclude: cancel ${excludeCanceled ? 'ON' : 'OFF'}, restocking ${excludeRestocking ? 'ON' : 'OFF'}, abandoned ${excludeAbandoned ? 'ON' : 'OFF'}, RTS ${excludeRts ? 'ON' : 'OFF'}`,
    ].join(' • ');

    return (
      <div className="space-y-1">
        <p className="font-semibold text-slate-800">Net Margin inputs</p>
        <div className="flex justify-between text-slate-800">
          <span>Delivered COD</span>
          <span>{nf(kpis.delivered ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>SF SDR Fees</span>
          <span>{neg(kpis.sf_sdr_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>FF SDR Fees</span>
          <span>{neg(kpis.ff_sdr_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>IF SDR Fees</span>
          <span>{neg(kpis.if_sdr_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COD Fee (Delivered)</span>
          <span>{neg(kpis.cod_fee_delivered ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COGS Delivered</span>
          <span>{neg(kpis.cogs_delivered ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>Ad Spend</span>
          <span>{neg(kpis.ad_spend ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-semibold">
          <span>Net Margin</span>
          <span>{nf(kpis.net_margin ?? 0)}</span>
        </div>
        <p className="text-xs text-slate-500">{filtersLabel}</p>
      </div>
    );
  };

  const buildCmRtsTooltip = (kpis: OverviewResponse['kpis'] | undefined): ReactNode | null => {
    if (!kpis) return null;
    const nf = (v: number) => formatMetricValue(v, 'currency');
    const neg = (v: number) => (v === 0 ? nf(0) : `- ${nf(Math.abs(v))}`);
    const pos = (v: number) => (v === 0 ? nf(0) : `+ ${nf(Math.abs(v))}`);
    const cogsTotal = kpis.cogs ?? 0;
    const cogsCanceled = excludeCanceled ? kpis.cogs_canceled ?? 0 : 0;
    const cogsRestocking = excludeRestocking ? kpis.cogs_restocking ?? 0 : 0;
    const cogsAdjusted = cogsTotal - cogsCanceled - cogsRestocking;
    const adjustedGrossCod = computeAdjustedGrossCod(kpis, {
      excludeCancel: excludeCanceled,
      excludeRestocking: excludeRestocking,
      excludeAbandoned,
    });
    const purchasesForCmRts =
      (data?.counts?.purchases ?? 0) + (excludeRts ? data?.counts?.rts ?? 0 : 0);
    const aovForCmRts = purchasesForCmRts > 0 ? adjustedGrossCod / purchasesForCmRts : 0;
    const revenueBaseForCmRts = aovForCmRts * purchasesForCmRts;
    const forecast = computeCmRtsForecast({
      revenueBase: revenueBaseForCmRts,
      adSpend: kpis.ad_spend ?? 0,
      sf: kpis.sf_fees ?? 0,
      ff: kpis.ff_fees ?? 0,
      iF: kpis.if_fees ?? 0,
      codFeeDelivered: kpis.cod_fee_delivered ?? 0,
      cogsAdjusted,
      cogsRts: kpis.cogs_rts ?? 0,
      rtsPct: rtsForecastSafe,
    });
    const filtersLabel = [
      `${startDate} → ${endDate}`,
      `${selectedMappings.length || 0}/${mappingOptions.length || 0} mappings`,
      `Exclude: cancel ${excludeCanceled ? 'ON' : 'OFF'}, restocking ${excludeRestocking ? 'ON' : 'OFF'}, abandoned ${excludeAbandoned ? 'ON' : 'OFF'}`,
      `RTS %: ${rtsForecastSafe}`,
    ].join(' • ');

    return (
      <div className="space-y-1">
        <p className="font-semibold text-slate-800">CM (RTS {rtsForecastSafe}%) inputs</p>
        <div className="flex justify-between text-slate-800">
          <span>Purchases (adj)</span>
          <span>{purchasesForCmRts.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>AOV (adj)</span>
          <span>{nf(aovForCmRts)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>Revenue base (AOV × purchases)</span>
          <span>{nf(revenueBaseForCmRts)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>RTS forecast ({rtsForecastSafe}%)</span>
          <span>{neg(revenueBaseForCmRts * forecast.rtsFraction)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>Revenue after RTS</span>
          <span>{nf(forecast.revenueAfterRts)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>Ad Spend</span>
          <span>{neg(kpis.ad_spend ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>Fulfillment (SF+FF+IF)</span>
          <span>{neg((kpis.sf_fees ?? 0) + (kpis.ff_fees ?? 0) + (kpis.if_fees ?? 0))}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COD Fee (Delivered)</span>
          <span>{neg(kpis.cod_fee_delivered ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COGS (raw)</span>
          <span>{neg(cogsTotal)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COGS Canceled</span>
          <span>{neg(cogsCanceled)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>COGS Restocking</span>
          <span>{neg(cogsRestocking)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>COGS (adjusted)</span>
          <span>{neg(cogsAdjusted)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>RTS COGS</span>
          <span>{pos(kpis.cogs_rts ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-semibold">
          <span>CM (RTS {rtsForecastSafe}%)</span>
          <span>{nf(forecast.cmForecast)}</span>
        </div>
        <p className="text-xs text-slate-500">{filtersLabel}</p>
      </div>
    );
  };

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const hasHorizontalOverflow = container.scrollWidth > container.clientWidth + 1;
    if (!hasHorizontalOverflow) return;

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  };

  const renderCard = (m: (typeof metricValues)[number]) => {
    const tooltip =
      m.key === 'cm_rts_forecast'
        ? buildCmRtsTooltip(data?.kpis)
        : m.key === 'contribution_margin'
          ? buildCmTooltip(data?.kpis)
          : m.key === 'net_margin'
            ? buildNmTooltip(data?.kpis)
            : m.key === 'ar_pct'
              ? null
              : null;

    return (
      <AnalyticsMetricCard
        key={m.key}
        label={m.label}
        value={m.current}
        format={m.format}
        precision={m.format === 'percent' ? 1 : 2}
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
        tooltipMode={m.key === 'contribution_margin' ? 'popover' : 'hover'}
        className="w-full panel panel-content xl:min-w-[190px] xl:w-auto"
      />
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs-tight font-semibold uppercase tracking-[0.2em] text-primary">
            Analytics
          </p>
          <div className="space-y-0.5">
            <h1 className="text-xl-loose font-semibold tracking-tight text-slate-900">
              Sales Analytics
            </h1>
            <p className="text-sm-custom text-slate-500">
              Monitor sales performance by mapping.
            </p>
          </div>
        </div>
      </header>

      <DashboardSection
        title="Sales Monitoring"
        icon={<ShoppingBag className="h-3.5 w-3.5 text-orange-500" />}
        meta={`Last updated: ${data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : '-'}`}
        className="panel panel-content"
        contentClassName="space-y-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-stretch">
              <AnalyticsMultiSelectPicker
                className="relative [&>button]:h-10 [&>button]:rounded-r-none [&>button]:rounded-l-xl [&>button]:border-r-0 [&>button]:border-slate-200"
                selectedLabel={selectedMappingLabel}
                selectTitle="Select mappings"
                options={mappingPickerOptions}
                allChecked={
                  mappingOptions.length > 0 &&
                  selectedMappings.length === mappingOptions.length
                }
                isChecked={isChecked}
                onToggleAll={(checked) => {
                  setSelectedMappings(checked ? mappingOptions : []);
                }}
                onToggle={(value) => {
                  setSelectedMappings((prev) =>
                    prev.includes(value)
                      ? prev.filter((entry) => entry !== value)
                      : [...prev, value],
                  );
                }}
                onOnly={(value) => {
                  setSelectedMappings([value]);
                }}
                onClear={() => setSelectedMappings([])}
              />
              <div className="relative" ref={filterMenuContentRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterMenu((p) => !p)}
                  className="inline-flex h-10 items-center justify-center rounded-r-xl rounded-l-none border border-slate-200 bg-white px-3 text-slate-600 hover:border-orange-200 hover:text-orange-700"
                  aria-label="Filters"
                >
                  <Filter className="h-4 w-4" />
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg z-30 p-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
                        checked={excludeCanceled}
                        onChange={(e) => setExcludeCanceled(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude Canceled</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
                        checked={excludeRestocking}
                        onChange={(e) => setExcludeRestocking(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude Restocking</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
                        checked={excludeAbandoned}
                        onChange={(e) => setExcludeAbandoned(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude Abandoned</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
                        checked={excludeRts}
                        onChange={(e) => setExcludeRts(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude RTS</span>
                    </label>
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="space-y-1">
                      <label className="text-sm text-slate-800 flex items-center justify-between">
                        <span>RTS %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Number.isFinite(rtsForecastPct) ? rtsForecastPct : 20}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (Number.isNaN(val)) {
                              setRtsForecastPct(20);
                              return;
                            }
                            setRtsForecastPct(Math.min(100, Math.max(0, val)));
                          }}
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:border-indigo-300"
                        />
                      </label>
                      <p className="text-xs text-slate-500">Used for CM (RTS %) forecast column</p>
                    </div>
                    <div className="h-px bg-slate-100 my-1" />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
                        checked={includeTax12}
                        onChange={(e) => setIncludeTax12(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Include 12% Ads Tax</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-orange-500 checked:border-orange-500 checked:bg-orange-500 focus:ring-2 focus:ring-orange-200"
                        checked={includeTax1}
                        onChange={(e) => setIncludeTax1(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Include 1% transaction fee</span>
                    </label>
                  </div>
                )}
              </div>
          </div>

          <div className="flex items-center gap-2">
              <div className="relative" ref={filterMenuRef}>
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
                    salesDateRangeIsToday ? 'w-10' : 'w-[200px] sm:w-[236px]'
                  }`}
                  containerClassName=""
                  popupClassName={(defaultClass) => `${defaultClass} z-50 kpi-datepicker-light`}
                  displayFormat="MM/DD/YYYY"
                  separator=" – "
                  toggleIcon={() => (
                    <span className="flex w-full items-center gap-2 overflow-hidden">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span
                        className={`whitespace-nowrap text-xs font-medium text-slate-700 transition-all duration-300 ease-out ${
                          salesDateRangeIsToday
                            ? 'max-w-0 -translate-x-1 opacity-0'
                            : 'max-w-[148px] sm:max-w-[184px] translate-x-0 opacity-100'
                        }`}
                      >
                        {salesDateRangeButtonLabel}
                      </span>
                    </span>
                  )}
                  toggleClassName="absolute inset-0 flex items-center justify-start px-3 text-slate-600 hover:text-orange-700 cursor-pointer"
                  placeholder=" "
                />
              </div>
              <div className="relative flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={reconcileRange}
                  disabled={isReconciling}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:opacity-60"
                  aria-label="Reconcile date range"
                  title="Reconcile date range"
                >
                  <RefreshCw className={`h-4 w-4 ${isReconciling ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowKpiVisibilityModal(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  aria-label="Show or hide KPI boxes"
                  title="Show or hide KPI boxes"
                >
                  <Columns className="h-4 w-4" />
                </button>
                {canShare && (
                  <button
                    type="button"
                    onClick={openShareModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    aria-label="Share analytics"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                )}
              </div>
          </div>
        </div>

        {error && (
          <AlertBanner tone="error" message={error} className="mt-4" />
        )}

        <div className="flex flex-col gap-3 xl:flex-row">
          {isLoading ? (
            <div className="flex w-full flex-col gap-3 xl:flex-row">
              {Array.from({ length: 8 }).map((_, idx) => (
                <AnalyticsMetricCardSkeleton key={idx} className="w-full xl:min-w-[180px]" />
              ))}
            </div>
          ) : (
            <>
              {visibleMetricValues.length === 0 ? (
                <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  No KPI boxes selected.
                </div>
              ) : (
                <>
                  {leftCard && renderCard(leftCard)}
                  <div
                    className="w-full max-h-[30vh] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184_/_0.45)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/40 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/60 xl:flex-1 xl:max-h-none xl:overflow-x-auto xl:overflow-y-hidden xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:h-0 xl:[&::-webkit-scrollbar]:w-0"
                    onWheel={handleWheelScroll}
                  >
                    <div className="flex flex-col gap-3 xl:min-w-full xl:flex-row">
                      {middleCards.map((m) => renderCard(m))}
                    </div>
                  </div>
                  {rightCard && renderCard(rightCard)}
                </>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-3 xl:flex-row">
          {isLoading ? (
            <div className="flex w-full flex-col gap-3 xl:flex-row">
              {Array.from({ length: 3 }).map((_, idx) => (
                <AnalyticsMetricCardSkeleton key={`sec-skel-${idx}`} className="w-full xl:min-w-[190px]" />
              ))}
            </div>
          ) : (
            <>
              {visibleSecondaryCards.length === 0 ? null : (
                <>
                  {leftSecondary && renderCard(leftSecondary)}
                  <div
                    className="w-full max-h-[30vh] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184_/_0.45)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/40 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/60 xl:flex-1 xl:max-h-none xl:overflow-x-auto xl:overflow-y-hidden xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:h-0 xl:[&::-webkit-scrollbar]:w-0"
                    onWheel={handleWheelScroll}
                  >
                    <div className="flex flex-col gap-3 xl:min-w-full xl:flex-row">
                      {middleSecondary.map((m) => renderCard(m))}
                    </div>
                  </div>
                  {fixedRightSecondary.length > 0 && (
                    <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row">
                      {fixedRightSecondary.map((m) => renderCard(m))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </DashboardSection>

      {/* Revenue per Product / Delivery Status */}
      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-2">
      <DashboardSection
        title="Sales Breakdown"
        icon={<BarChart3 className="h-3.5 w-3.5 text-orange-500" />}
        contentClassName="space-y-3"
      >
        <div className="flex items-center justify-between">
          <AnalyticsTableSelector
            className="relative"
            options={tableOptions}
            selectedKey={tableSelection}
            fallbackLabel="Revenue per Product"
            onSelect={(key) => {
              setTableSelection(key);
              setProductPage(1);
              setDeliveryPage(1);
            }}
          />
          {tableSelection === 'products' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Download className="h-4 w-4" />}
                onClick={() => void handleExportProductsCsv()}
                disabled={isLoading || exportableProducts.length === 0}
                loading={isExportingCsv}
              >
                Export CSV
              </Button>
              <Button
                size="sm"
                iconLeft={<FileSpreadsheet className="h-4 w-4" />}
                onClick={() => void handleExportProductsXlsx()}
                disabled={isLoading || exportableProducts.length === 0}
                loading={isExportingXlsx}
              >
                Export XLSX
              </Button>
            </div>
          )}
        </div>

        {tableSelection === 'products' ? (
          <AnalyticsSalesProductsTable
            isLoading={isLoading}
            productStart={productStart}
            productEnd={productEnd}
            totalProducts={totalProducts}
            onPrevious={() => setProductPage((p) => Math.max(1, p - 1))}
            onNext={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
            canPrevious={productCanPrev}
            canNext={productCanNext}
            pageSize={pageSize}
            productPage={productPage}
            rtsForecastSafe={rtsForecastSafe}
            rows={pagedProducts}
            sourceCount={products.length}
            renderSortLabel={renderSortLabel}
          />
        ) : (
          <AnalyticsSalesDeliveryTable
            isLoading={isLoading}
            deliveryStart={deliveryStart}
            deliveryEnd={deliveryEnd}
            totalDelivery={totalDelivery}
            onPrevious={() => setDeliveryPage((p) => Math.max(1, p - 1))}
            onNext={() => setDeliveryPage((p) => Math.min(totalDeliveryPages, p + 1))}
            canPrevious={deliveryCanPrev}
            canNext={deliveryCanNext}
            pageSize={pageSize}
            deliveryPage={deliveryPage}
            rows={pagedDeliveryRows}
            sourceCount={deliveryStatuses.length}
            renderSortLabel={renderDeliverySortLabel}
          />
        )}
      </DashboardSection>

      <AnalyticsShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share Sales Analytics"
        loading={shareLoading}
        saving={shareSaving}
        teams={shareTeams}
        currentTeamId={currentTeamId}
        selectedTeamIds={shareSelected}
        onToggleTeam={toggleShareTeam}
        onSave={saveShare}
      />
      <AnalyticsKpiVisibilityDialog
        open={showKpiVisibilityModal}
        onOpenChange={setShowKpiVisibilityModal}
        options={kpiVisibilityOptions}
        selectedKeys={visibleKpiKeys}
        onToggleKey={(key) =>
          setVisibleKpiKeys((prev) =>
            prev.includes(key)
              ? prev.filter((entry) => entry !== key)
              : [...prev, key],
          )
        }
        onSelectAll={() => setVisibleKpiKeys(DEFAULT_VISIBLE_KPI_KEYS)}
        onResetDefaults={() => setVisibleKpiKeys(DEFAULT_VISIBLE_KPI_KEYS)}
      />

    </div>
  );
}

