'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { AlertBanner } from '@/components/ui/feedback';
import { BarChart3, Filter, Gauge, Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { DashboardSection } from '../../dashboard/_components/dashboard-section';
import { AnalyticsShareDialog } from '../_components/analytics-share-dialog';
import { AnalyticsMultiSelectPicker } from '../_components/analytics-multi-select-picker';
import {
  AnalyticsTableSelector,
  type AnalyticsTableSelectorOption,
} from '../_components/analytics-table-selector';
import {
  AnalyticsTableEmptyRow,
  AnalyticsTableLoadingRows,
  AnalyticsTableShell,
} from '../_components/analytics-table-shell';
import { useAnalyticsDateRange } from '../_hooks/use-analytics-date-range';
import { useAnalyticsShare } from '../_hooks/use-analytics-share';
import { useVisibleAutoRefresh } from '../_hooks/use-visible-auto-refresh';
import { useWorkflowTenantEvent } from '../_hooks/use-workflow-tenant-event';
import { analyticsOverviewApi } from '../_services/analytics-overview-api';
import {
  formatDeltaPercent,
  formatMetricValue,
  formatPhpCurrency,
  toTitleCase,
} from '../_utils/metrics';
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

type OverviewResponse = {
  kpis: Record<string, number>;
  prevKpis: Record<string, number>;
  filters: { associates: string[]; associatesDisplayMap: Record<string, string> };
  selected: { start_date: string; end_date: string; associates: string[] };
  rangeDays: number;
  lastUpdatedAt: string | null;
  topAssociates?: Array<{
    associate: string;
    associateDisplay?: string;
    revenue: number;
    cpc: number;
    ad_spend: number;
    ar_pct: number;
    conversion_pct: number;
    ads_running: number;
    ads_created: number;
    ads_active: number;
  }>;
  topCampaigns?: Array<{
    campaign: string;
    revenue: number;
    cpc: number;
    ad_spend: number;
    ar_pct: number;
  }>;
  topCreatives?: Array<{
    associate: string;
    associateDisplay?: string;
    ad_name: string;
    revenue: number;
    cpc: number;
    ad_spend: number;
    ar_pct: number;
  }>;
};

const metricDefinitions: {
  key: keyof OverviewResponse['kpis'];
  label: string;
  format: 'currency' | 'percent' | 'number';
}[] = [
  { key: 'revenue', label: 'Revenue (₱)', format: 'currency' },
  { key: 'ad_spend', label: 'Ad Spend (₱)', format: 'currency' },
  { key: 'ar', label: 'AR (%)', format: 'percent' },
  { key: 'link_clicks', label: 'Link Clicks', format: 'number' },
  { key: 'cpc', label: 'CPC (₱)', format: 'currency' },
  { key: 'ctr', label: 'CTR (%)', format: 'percent' },
  { key: 'gross_sales', label: 'Gross Sale (#)', format: 'number' },
  { key: 'roas', label: 'ROAS (x)', format: 'number' },
  { key: 'cpp', label: 'CPP (₱)', format: 'currency' },
  { key: 'leads', label: 'Leads', format: 'number' },
  { key: 'cpl', label: 'Cost Per Lead (₱)', format: 'currency' },
  { key: 'conversion_rate', label: 'Conversion Rate (%)', format: 'percent' },
];

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

export default function MarketingAnalyticsPage() {
  const { range, startDate, endDate, handleDateRangeChange, syncDateRangeFromApi } =
    useAnalyticsDateRange();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssociates, setSelectedAssociates] = useState<string[]>([]);
  const [isAllAssociatesMode, setIsAllAssociatesMode] = useState(true);
  const [associatesOptions, setAssociatesOptions] = useState<string[]>([]);
  const [associatesDisplayMap, setAssociatesDisplayMap] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [topAssociates, setTopAssociates] = useState<OverviewResponse['topAssociates']>([]);
  const [topCampaigns, setTopCampaigns] = useState<OverviewResponse['topCampaigns']>([]);
  const [topCreatives, setTopCreatives] = useState<OverviewResponse['topCreatives']>([]);
  const [tableSelection, setTableSelection] = useState<'associates' | 'campaigns' | 'creatives'>('associates');
  const [topAssocPage, setTopAssocPage] = useState(1);
  const [topCampaignPage, setTopCampaignPage] = useState(1);
  const [topCreativePage, setTopCreativePage] = useState(1);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [excludeCanceled, setExcludeCanceled] = useState(true);
  const [excludeRestocking, setExcludeRestocking] = useState(true);
  const [excludeAbandoned, setExcludeAbandoned] = useState(true);
  const associatesOptionsRef = useRef<string[]>([]);
  const selectedAssociatesRef = useRef<string[]>([]);
  const isAllAssociatesModeRef = useRef(true);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterMenuContentRef = useRef<HTMLDivElement | null>(null);
  const normalizedOptions = () => associatesOptions.map((a) => a.toLowerCase());
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
  } = useAnalyticsShare('marketing');

  const fetchDataRef = useRef<((opts?: { silent?: boolean }) => Promise<void>) | null>(null);

  useEffect(() => {
    associatesOptionsRef.current = associatesOptions;
  }, [associatesOptions]);

  useEffect(() => {
    selectedAssociatesRef.current = selectedAssociates;
  }, [selectedAssociates]);

  useEffect(() => {
    isAllAssociatesModeRef.current = isAllAssociatesMode;
  }, [isAllAssociatesMode]);

  const parseErrorMessage = (error: unknown, fallback: string) => {
    if (!error || typeof error !== 'object') return fallback;
    const maybeError = error as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };
    const responseMessage = maybeError.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) return responseMessage;
    if (typeof maybeError.message === 'string' && maybeError.message.trim().length > 0) return maybeError.message;
    return fallback;
  };

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError(null);
    try {
      const currentOptions = associatesOptionsRef.current;
      const currentSelected = selectedAssociatesRef.current;
      const allPreviouslySelected = isAllAssociatesModeRef.current;
      const normalizedOpts = currentOptions.map((a) => a.toLowerCase());
      const effectiveSel = allPreviouslySelected ? normalizedOpts : currentSelected;
      const sendAll =
        allPreviouslySelected ||
        (effectiveSel.length > 0 && effectiveSel.length === normalizedOpts.length);
      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      params.set('tables', tableSelection);
      if (!sendAll) {
        const scopedSelection = effectiveSel.length > 0 ? effectiveSel : ['__no_selection__'];
        scopedSelection.forEach((a) => params.append('associate', a));
      }
      params.set('exclude_cancel', String(excludeCanceled));
      params.set('exclude_restocking', String(excludeRestocking));
      params.set('exclude_abandoned', String(excludeAbandoned));
      const res = await analyticsOverviewApi.getMarketingOverview<OverviewResponse>(params);
      setData(res.data);
      const options = res.data.filters.associates || [];
      const normalized = options.map((a) => a.toLowerCase());
      setAssociatesOptions((prev) => (areArraysEqual(prev, options) ? prev : options));
      const nextDisplayMap = res.data.filters.associatesDisplayMap || {};
      setAssociatesDisplayMap((prev) => (areRecordsEqual(prev, nextDisplayMap) ? prev : nextDisplayMap));
      if (allPreviouslySelected) {
        setSelectedAssociates((prev) => (areArraysEqual(prev, normalized) ? prev : normalized));
      } else {
        const boundedSel = currentSelected.filter((p) => normalized.includes(p));
        setSelectedAssociates((prev) => (areArraysEqual(prev, boundedSel) ? prev : boundedSel));
      }
      setLastUpdated(res.data.lastUpdatedAt);
      setTopAssociates(res.data.topAssociates || []);
      setTopCampaigns(res.data.topCampaigns || []);
      setTopAssocPage(1);
      setTopCampaignPage(1);
      setTopCreatives(res.data.topCreatives || []);
      setTopCreativePage(1);
      // Sync selected range if API adjusted it
      syncDateRangeFromApi(res.data.selected.start_date, res.data.selected.end_date);
    } catch (error: unknown) {
      setError(parseErrorMessage(error, 'Failed to load marketing overview'));
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [
    endDate,
    excludeAbandoned,
    excludeCanceled,
    excludeRestocking,
    startDate,
    syncDateRangeFromApi,
    tableSelection,
  ]);

  useEffect(() => {
    const onTeamScope = () => {
      void fetchData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
      }
    };
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, selectedAssociates, isAllAssociatesMode]);

  useVisibleAutoRefresh(() => {
    void fetchData({ silent: true });
  });

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useWorkflowTenantEvent('marketing:updated', () => {
    fetchDataRef.current?.({ silent: true });
  });

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node | null;
      const inFilter =
        filterMenuRef.current?.contains(target) || filterMenuContentRef.current?.contains(target);
      if (showFilterMenu && target && !inFilter) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  const handleResetAssociates = () => {
    setIsAllAssociatesMode(true);
    setSelectedAssociates([]);
  };

  const toggleAssociate = (norm: string) => {
    if (isAllAssociatesMode) {
      setIsAllAssociatesMode(false);
      setSelectedAssociates(normalizedOptions().filter((v) => v !== norm));
      return;
    }
    const has = selectedAssociates.includes(norm);
    const next = has
      ? selectedAssociates.filter((v) => v !== norm)
      : [...selectedAssociates, norm];
    if (associatesOptions.length > 0 && next.length === associatesOptions.length) {
      setIsAllAssociatesMode(true);
      setSelectedAssociates(normalizedOptions());
      return;
    }
    setSelectedAssociates(next);
  };

  const associateDisplay = (val: string) => associatesDisplayMap[val.toLowerCase()] || val;
  const associatePickerOptions = Object.values(
    associatesOptions.reduce<Record<string, { value: string; label: string }>>((acc, assoc) => {
      const norm = assoc.toLowerCase();
      if (!acc[norm]) {
        acc[norm] = {
          value: norm,
          label: toTitleCase(associateDisplay(assoc)),
        };
      }
      return acc;
    }, {}),
  );
  const selectedAssociateLabel =
    isAllAssociatesMode
      ? 'All associates'
      : `${selectedAssociates.length} selected`;
  const isChecked = (norm: string) => isAllAssociatesMode || selectedAssociates.includes(norm);

  const metrics = data ? metricDefinitions.map((def) => {
    const current = data.kpis[def.key] ?? 0;
    const previous = data.prevKpis[def.key] ?? 0;
    const delta = formatDeltaPercent(current, previous);
    return {
      ...def,
      current,
      previous,
      delta,
    };
  }) : [];

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleString()
    : '—';

  const pageSize = 10;
  const totalTopAssociates = topAssociates?.length || 0;
  const totalTopPages = Math.max(1, Math.ceil(totalTopAssociates / pageSize));
  const pagedTopAssociates = (topAssociates || []).slice((topAssocPage - 1) * pageSize, topAssocPage * pageSize);
  const topAssocStart = totalTopAssociates === 0 ? 0 : (topAssocPage - 1) * pageSize + 1;
  const topAssocEnd = Math.min(topAssocPage * pageSize, totalTopAssociates);
  const topAssocCanPrev = topAssocPage > 1;
  const topAssocCanNext = topAssocPage < totalTopPages;

  const tableOptions: AnalyticsTableSelectorOption<
    'associates' | 'campaigns' | 'creatives'
  >[] = [
    { key: 'associates', label: 'Top Associates' },
    { key: 'campaigns', label: 'Top Campaigns' },
    { key: 'creatives', label: 'Top Creatives' },
  ];

  const totalTopCampaigns = topCampaigns?.length || 0;
  const totalCampaignPages = Math.max(1, Math.ceil(totalTopCampaigns / pageSize));
  const pagedTopCampaigns = (topCampaigns || []).slice((topCampaignPage - 1) * pageSize, topCampaignPage * pageSize);
  const topCampaignStart = totalTopCampaigns === 0 ? 0 : (topCampaignPage - 1) * pageSize + 1;
  const topCampaignEnd = Math.min(topCampaignPage * pageSize, totalTopCampaigns);
  const topCampaignCanPrev = topCampaignPage > 1;
  const topCampaignCanNext = topCampaignPage < totalCampaignPages;

  const totalTopCreatives = topCreatives?.length || 0;
  const totalCreativePages = Math.max(1, Math.ceil(totalTopCreatives / pageSize));
  const pagedTopCreatives = (topCreatives || []).slice((topCreativePage - 1) * pageSize, topCreativePage * pageSize);
  const topCreativeStart = totalTopCreatives === 0 ? 0 : (topCreativePage - 1) * pageSize + 1;
  const topCreativeEnd = Math.min(topCreativePage * pageSize, totalTopCreatives);
  const topCreativeCanPrev = topCreativePage > 1;
  const topCreativeCanNext = topCreativePage < totalCreativePages;
  const activeMarketingRowCount =
    tableSelection === 'associates'
      ? totalTopAssociates
      : tableSelection === 'campaigns'
        ? totalTopCampaigns
        : totalTopCreatives;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing Analytics"
        description="Monitor revenue, spend, and efficiency by marketing associate."
      />

      <DashboardSection
        title="Marketing Monitoring"
        icon={<Gauge className="h-3.5 w-3.5 text-orange-500" />}
        meta={`Last updated: ${lastUpdatedLabel}`}
        className="border-orange-100 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25"
        contentClassName="space-y-5"
      >
        {/* Filters Row */}
        <div className="flex flex-wrap items-start gap-x-8">
          {/* Marketing Associate */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Marketing Associate</p>
            <AnalyticsMultiSelectPicker
              className="relative"
              selectedLabel={selectedAssociateLabel}
              selectTitle="Select associates"
              options={associatePickerOptions}
              allChecked={isAllAssociatesMode}
              isChecked={isChecked}
              onToggleAll={(checked) => {
                setIsAllAssociatesMode(checked);
                setSelectedAssociates(checked ? normalizedOptions() : []);
              }}
              onToggle={toggleAssociate}
              onOnly={(value) => {
                setIsAllAssociatesMode(false);
                setSelectedAssociates([value]);
              }}
              onClear={handleResetAssociates}
            />
          </div>

          {/* Date Range */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Date range</p>
            <div className="flex items-center gap-2">
              <div className="relative" ref={filterMenuRef}>
                <Datepicker
                  value={range}
                  onChange={handleDateRangeChange}
                  inputClassName="rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-300"
                  containerClassName=""
                  popupClassName={(defaultClass) => `${defaultClass} z-50`}
                  displayFormat="MM/DD/YYYY"
                  separator=" – "
                  toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  placeholder=""
                />
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilterMenu((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-slate-600 bg-white hover:border-slate-300"
                >
                  <Filter className="h-4 w-4" />
                  <span className="text-sm"></span>
                </button>
                {canShare && (
                  <button
                    type="button"
                    onClick={openShareModal}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2 py-2 text-slate-600 bg-white hover:border-slate-300 ml-2"
                    aria-label="Share analytics"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                )}
                {showFilterMenu && (
                  <div
                    ref={filterMenuContentRef}
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg z-30 p-3 space-y-3"
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={excludeCanceled}
                        onChange={(e) => setExcludeCanceled(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude Canceled</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={excludeRestocking}
                        onChange={(e) => setExcludeRestocking(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude Restocking</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={excludeAbandoned}
                        onChange={(e) => setExcludeAbandoned(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Exclude Abandoned</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <AlertBanner tone="error" message={error} className="mt-4" />
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                      {formatMetricValue(m.current, m.format)}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${deltaColor}`}>
                      {deltaLabel}
                      {data?.rangeDays ? ` from previous ${data.rangeDays} day${data.rangeDays > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                );
              })}
        </div>
      </DashboardSection>

      {/* Top Tables */}
      <DashboardSection
        title="Marketing Breakdown"
        icon={<BarChart3 className="h-3.5 w-3.5 text-orange-500" />}
        meta={`${activeMarketingRowCount} rows`}
        className="border-orange-100 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25"
        contentClassName="space-y-3"
      >
        <div className="flex items-center justify-between">
          <AnalyticsTableSelector
            className="relative"
            options={tableOptions}
            selectedKey={tableSelection}
            fallbackLabel="Top Associates"
            onSelect={(key) => {
              setTableSelection(key);
              setTopAssocPage(1);
              setTopCampaignPage(1);
              setTopCreativePage(1);
            }}
          />
        </div>
        {tableSelection === 'associates' && (
          <AnalyticsTableShell
            summaryLabel={`Showing ${topAssocStart}-${topAssocEnd} of ${totalTopAssociates}`}
            onPrevious={() => setTopAssocPage((p) => Math.max(1, p - 1))}
            onNext={() => setTopAssocPage((p) => (topAssocCanNext ? p + 1 : p))}
            canPrevious={topAssocCanPrev}
            canNext={topAssocCanNext}
            isLoading={isLoading}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Marketing Associate</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Revenue (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">CPC (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ad Spend (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">AR (%)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Conversion (%)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ads Running</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ads Created</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ads Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <AnalyticsTableLoadingRows colCount={10} />
                  ) : (
                    pagedTopAssociates.map((row, idx) => (
                      <tr key={`${row.associate}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{(topAssocPage - 1) * pageSize + idx + 1}.</td>
                        <td className="px-3 py-3 text-sm font-medium whitespace-nowrap text-slate-900 sm:px-4 lg:px-6">
                          {toTitleCase(row.associateDisplay || row.associate)}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.revenue)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.cpc)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.ad_spend)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{(row.ar_pct ?? 0).toFixed(1)}%</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{(row.conversion_pct ?? 0).toFixed(1)}%</td>
                        <td className="px-3 py-3 text-sm text-center whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{row.ads_running ?? 0}</td>
                        <td className="px-3 py-3 text-sm text-center whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{row.ads_created ?? 0}</td>
                        <td className="px-3 py-3 text-sm text-center whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{row.ads_active ?? 0}</td>
                      </tr>
                    ))
                  )}
                  {!isLoading && (!topAssociates || topAssociates.length === 0) ? (
                    <AnalyticsTableEmptyRow colSpan={10} message="No associates found for this range." />
                  ) : null}
                </tbody>
              </table>
            </div>
          </AnalyticsTableShell>
        )}
        {tableSelection === 'campaigns' && (
          <AnalyticsTableShell
            summaryLabel={`Showing ${topCampaignStart}-${topCampaignEnd} of ${totalTopCampaigns}`}
            onPrevious={() => setTopCampaignPage((p) => Math.max(1, p - 1))}
            onNext={() => setTopCampaignPage((p) => (topCampaignCanNext ? p + 1 : p))}
            canPrevious={topCampaignCanPrev}
            canNext={topCampaignCanNext}
            isLoading={isLoading}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Campaign</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Revenue (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">CPC (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ad Spend (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">AR (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <AnalyticsTableLoadingRows colCount={6} />
                  ) : (
                    pagedTopCampaigns.map((row, idx) => (
                      <tr key={`${row.campaign}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">
                          {(topCampaignPage - 1) * pageSize + idx + 1}.
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-slate-900 sm:px-4 lg:px-6">
                          <div className="min-w-[150px] max-w-[260px]">
                            <div className="truncate" title={row.campaign}>{row.campaign || '—'}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.revenue)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.cpc)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.ad_spend)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{(row.ar_pct ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                  {!isLoading && (!topCampaigns || topCampaigns.length === 0) ? (
                    <AnalyticsTableEmptyRow colSpan={6} message="No campaigns found for this range." />
                  ) : null}
                </tbody>
              </table>
            </div>
          </AnalyticsTableShell>
        )}
        {tableSelection === 'creatives' && (
          <AnalyticsTableShell
            summaryLabel={`Showing ${topCreativeStart}-${topCreativeEnd} of ${totalTopCreatives}`}
            onPrevious={() => setTopCreativePage((p) => Math.max(1, p - 1))}
            onNext={() => setTopCreativePage((p) => (topCreativeCanNext ? p + 1 : p))}
            canPrevious={topCreativeCanPrev}
            canNext={topCreativeCanNext}
            isLoading={isLoading}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Marketing Associate</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ad</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Revenue (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">CPC (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">Ad Spend (₱)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap text-slate-500 sm:px-4 lg:px-6">AR (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <AnalyticsTableLoadingRows colCount={7} />
                  ) : (
                    pagedTopCreatives.map((row, idx) => (
                      <tr key={`${row.associate}-${row.ad_name}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">
                          {(topCreativePage - 1) * pageSize + idx + 1}.
                        </td>
                        <td className="px-3 py-3 text-sm font-medium whitespace-nowrap text-slate-900 sm:px-4 lg:px-6">
                          {toTitleCase(row.associateDisplay || row.associate)}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-900 sm:px-4 lg:px-6">
                          <div className="min-w-[150px] max-w-[260px]">
                            <div className="truncate" title={row.ad_name || '—'}>{row.ad_name || '—'}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.revenue)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.cpc)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{formatPhpCurrency(row.ad_spend)}</td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap text-slate-700 sm:px-4 lg:px-6">{(row.ar_pct ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                  {!isLoading && (!topCreatives || topCreatives.length === 0) ? (
                    <AnalyticsTableEmptyRow colSpan={7} message="No creatives found for this range." />
                  ) : null}
                </tbody>
              </table>
            </div>
          </AnalyticsTableShell>
        )}
      </DashboardSection>
      <AnalyticsShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share Marketing Analytics"
        loading={shareLoading}
        saving={shareSaving}
        teams={shareTeams}
        currentTeamId={currentTeamId}
        selectedTeamIds={shareSelected}
        onToggleTeam={toggleShareTeam}
        onSave={saveShare}
      />
    </div>
  );
}
