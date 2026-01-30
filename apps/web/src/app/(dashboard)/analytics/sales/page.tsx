'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { ChevronDown, ChevronUp, Filter, Info, ShoppingBag, Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { workflowSocket } from '@/lib/socket-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });

type OverviewResponse = {
  kpis: {
    revenue: number;
    delivered: number;
    shipped: number;
    waiting_pickup: number;
    rts: number;
    ad_spend: number;
    ar_pct: number;
    profit_efficiency: number;
    conversion_rate: number;
    aov: number;
    cpp: number;
    processed_cpp: number;
    confirmed: number;
    unconfirmed: number;
    canceled: number;
    contribution_margin: number;
    net_margin: number;
    cogs: number;
    cogs_canceled: number;
    cogs_restocking: number;
    cogs_rts: number;
    cogs_delivered: number;
    cod_fee: number;
    cod_fee_delivered: number;
    gross_cod: number;
    rts_cod: number;
    canceled_cod: number;
    restocking_cod: number;
    sf_fees: number;
    ff_fees: number;
    if_fees: number;
    cm_rts_forecast?: number;
    rts_pct?: number;
    sf_sdr_fees: number;
    ff_sdr_fees: number;
    if_sdr_fees: number;
  };
  prevKpis: {
    revenue: number;
    delivered: number;
    shipped: number;
    waiting_pickup: number;
    rts: number;
    ad_spend: number;
    ar_pct: number;
    profit_efficiency: number;
    conversion_rate: number;
    aov: number;
    cpp: number;
    processed_cpp: number;
    confirmed: number;
    unconfirmed: number;
    canceled: number;
    contribution_margin: number;
    net_margin: number;
    cogs: number;
    cogs_canceled: number;
    cogs_restocking: number;
    cogs_rts: number;
    cogs_delivered: number;
    cod_fee: number;
    cod_fee_delivered: number;
    gross_cod: number;
    rts_cod: number;
    canceled_cod: number;
    restocking_cod: number;
    sf_fees: number;
    ff_fees: number;
    if_fees: number;
    cm_rts_forecast?: number;
    rts_pct?: number;
    sf_sdr_fees: number;
    ff_sdr_fees: number;
    if_sdr_fees: number;
  };
  counts: {
    purchases: number;
    delivered: number;
    shipped: number;
    waiting_pickup: number;
    rts: number;
    confirmed: number;
    unconfirmed: number;
    canceled: number;
  };
  prevCounts: {
    purchases: number;
    delivered: number;
    shipped: number;
    waiting_pickup: number;
    rts: number;
    confirmed: number;
    unconfirmed: number;
    canceled: number;
  };
  products: Array<{
    mapping: string | null;
    revenue: number;
    gross_sales: number;
    cogs: number;
    aov: number;
    cpp: number;
    processed_cpp: number;
    ad_spend: number;
    ar_pct: number;
    profit_efficiency: number;
    contribution_margin: number;
    net_margin: number;
    sf_fees?: number;
    ff_fees?: number;
    if_fees?: number;
    cod_fee_delivered?: number;
    cogs_rts?: number;
    rts_count?: number;
    delivered_count?: number;
    cod_raw?: number;
    purchases_raw?: number;
    sf_raw?: number;
    ff_raw?: number;
    if_raw?: number;
    cod_fee_delivered_raw?: number;
    cogs_ec?: number;
    cogs_restocking?: number;
  }>;
  filters: { mappings: string[]; mappingsDisplayMap: Record<string, string> };
  selected: { start_date: string; end_date: string; mappings: string[] };
  rangeDays: number;
  lastUpdatedAt: string | null;
};

const metricDefinitions: Array<{
  key: keyof OverviewResponse['kpis'];
  label: string;
  format: 'currency' | 'number' | 'percent';
  countKey?: keyof OverviewResponse['counts'];
  countLabel?: string;
}> = [
  { key: 'revenue', label: 'Revenue (₱)', format: 'currency', countKey: 'purchases', countLabel: 'Orders' },
  { key: 'unconfirmed', label: 'New (₱)', format: 'currency', countKey: 'unconfirmed', countLabel: 'Orders' },  
  { key: 'confirmed', label: 'Confirmed (₱)', format: 'currency', countKey: 'confirmed', countLabel: 'Orders' },
  { key: 'canceled', label: 'Canceled (₱)', format: 'currency', countKey: 'canceled', countLabel: 'Orders' },
  { key: 'waiting_pickup', label: 'Wait for Pickup (₱)', format: 'currency', countKey: 'waiting_pickup', countLabel: 'Waiting' },
  { key: 'shipped', label: 'Shipped (₱)', format: 'currency', countKey: 'shipped', countLabel: 'Shipped' },
  { key: 'delivered', label: 'Delivered (₱)', format: 'currency', countKey: 'delivered', countLabel: 'Delivered' },
  { key: 'rts', label: 'RTS (₱)', format: 'currency', countKey: 'rts', countLabel: 'RTS' },
  { key: 'ad_spend', label: 'Ad Spend (₱)', format: 'currency' },
] as const;

const secondaryMetricDefinitions: Array<{
  key: keyof OverviewResponse['kpis'];
  label: string;
  format: 'currency' | 'number' | 'percent';
}> = [
  { key: 'cm_rts_forecast', label: 'CM (RTS 20%)', format: 'currency' },
  { key: 'ar_pct', label: 'AR (%)', format: 'percent' },
  { key: 'aov', label: 'AOV (₱)', format: 'currency' },
  { key: 'cpp', label: 'CPP (₱)', format: 'currency' },
  { key: 'processed_cpp', label: 'Processed CPP (₱)', format: 'currency' },
  { key: 'rts_pct', label: 'RTS (%)', format: 'percent' },
  { key: 'conversion_rate', label: 'Conversion Rate (%)', format: 'percent' },
  { key: 'profit_efficiency', label: 'Profit Efficiency (%)', format: 'percent' },
  { key: 'contribution_margin', label: 'Contribution Margin (₱)', format: 'currency' },
  { key: 'net_margin', label: 'Net Margin (₱)', format: 'currency' },
];

function formatValue(val: number, format: 'currency' | 'number' | 'percent', decimals: number = 2) {
  if (!Number.isFinite(val)) return '—';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(val);
  }
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(val);
  return format === 'percent' ? `${formatted}%` : formatted;
}

function formatDelta(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) {
    return null;
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return delta;
}

function titleCase(str: string) {
  return str
    .split(' ')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function getSafeRtsForecastPct(pct: number) {
  return Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 20));
}

function computeCmRtsForecast(params: {
  codRaw: number;
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
  const revenueAfterRts = (1 - rtsFraction) * params.codRaw;
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

function computeAdjustedGrossCod(
  kpis: OverviewResponse['kpis'],
  opts: { excludeCancel: boolean; excludeRestocking: boolean },
) {
  const grossCod = kpis.gross_cod ?? 0;
  const canceledCod = opts.excludeCancel ? kpis.canceled_cod ?? 0 : 0;
  const restockingCod = opts.excludeRestocking ? kpis.restocking_cod ?? 0 : 0;
  return grossCod - canceledCod - restockingCod;
}

function computeRtsPctFromCounts(counts?: OverviewResponse['counts'] | null) {
  if (!counts) return 0;
  const delivered = counts.delivered ?? 0;
  const rts = counts.rts ?? 0;
  const total = delivered + rts;
  return total > 0 ? (rts / total) * 100 : 0;
}

export default function SalesAnalyticsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [selectedMappings, setSelectedMappings] = useState<string[]>([]);
  const [mappingOptions, setMappingOptions] = useState<string[]>([]);
  const [mappingDisplayMap, setMappingDisplayMap] = useState<Record<string, string>>({});
  const [showMappingPicker, setShowMappingPicker] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');
  const [range, setRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: new Date(today),
    endDate: new Date(today),
  });
  const [excludeCanceled, setExcludeCanceled] = useState(true);
  const [excludeRestocking, setExcludeRestocking] = useState(true);
  const [excludeRts, setExcludeRts] = useState(true);
  const [includeTax12, setIncludeTax12] = useState(false);
  const [includeTax1, setIncludeTax1] = useState(false);
  const [rtsForecastPct, setRtsForecastPct] = useState<number>(20);
  const mappingPickerRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterMenuContentRef = useRef<HTMLDivElement | null>(null);
  const scrollStripRef = useRef<HTMLDivElement | null>(null);
  const fetchDataRef = useRef<any>();
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const pageSize = 10;
  const [tableSelection, setTableSelection] = useState<'products'>('products');
  const [productPage, setProductPage] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTeams, setShareTeams] = useState<{ id: string; name: string }[]>([]);
  const [shareSelected, setShareSelected] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const rtsForecastSafe = getSafeRtsForecastPct(rtsForecastPct);
  const [sortKey, setSortKey] = useState<
    | 'index'
    | 'product'
    | 'revenue'
    | 'gross_sales'
    | 'cogs'
    | 'aov'
    | 'cpp'
    | 'processed_cpp'
    | 'ad_spend'
    | 'ar_pct'
    | 'rts_pct'
    | 'profit_efficiency'
    | 'contribution_margin'
    | 'cm_rts_forecast'
    | 'net_margin'
    | null
  >(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError(null);
    try {
      const normalizedOptions = mappingOptions.map((m) => m.toLowerCase());
      const effectiveSel = selectedMappings.length === 0 ? normalizedOptions : selectedMappings;
      const sendAll = effectiveSel.length === normalizedOptions.length;
      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      if (!sendAll && effectiveSel.length > 0) {
        effectiveSel.forEach((m) => params.append('mapping', m));
      }
      params.set('exclude_cancel', String(excludeCanceled));
      params.set('exclude_restocking', String(excludeRestocking));
      params.set('exclude_rts', String(excludeRts));
      params.set('include_tax_12', String(includeTax12));
      params.set('include_tax_1', String(includeTax1));
      const res = await apiClient.get<OverviewResponse>(`/analytics/sales/overview?${params.toString()}`);
      setData(res.data);
      const optsList = res.data.filters.mappings || [];
      const normalized = optsList.map((m) => m.toLowerCase());
      setMappingOptions(normalized);
      setMappingDisplayMap(res.data.filters.mappingsDisplayMap || {});
      const bounded = effectiveSel.filter((m) => normalized.includes(m));
      setSelectedMappings(bounded.length === 0 ? normalized : bounded);
      setStartDate(res.data.selected.start_date);
      setEndDate(res.data.selected.end_date);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load sales overview');
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_team_id');
      if (stored) setCurrentTeamId(stored);
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (Array.isArray(u?.permissions) && u.permissions.includes('analytics.share')) {
            setCanShare(true);
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    if (canShare) return;
    const fetchPerms = async () => {
      try {
        const res = await apiClient.get('/auth/permissions');
        const perms: string[] = res?.data?.permissions || [];
        if (perms.includes('analytics.share')) setCanShare(true);
      } catch {
        // ignore; keep false
      }
    };
    fetchPerms();
  }, [canShare]);

  const openShareModal = async () => {
    if (!canShare) return;
    setShareOpen(true);
    setShareLoading(true);
    try {
      let teamList: any[] = [];
      try {
        const res = await apiClient.get('/teams');
        teamList = res.data || [];
      } catch {
        const res = await apiClient.get('/teams/my-teams');
        teamList = res.data || [];
      }
      setShareTeams(teamList);
      const resShare = await apiClient.get('/analytics/shares', { params: { scope: 'sales' } });
      setShareSelected(resShare.data?.sharedTeamIds || []);
    } catch {
      setShareTeams([]);
      setShareSelected([]);
    } finally {
      setShareLoading(false);
    }
  };

  const toggleShareTeam = (id: string) => {
    setShareSelected((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const saveShare = async () => {
    setShareSaving(true);
    try {
      await apiClient.post('/analytics/shares', { scope: 'sales', sharedTeamIds: shareSelected });
      setShareOpen(false);
    } finally {
      setShareSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedMappings.join('|'), excludeCanceled, excludeRestocking, excludeRts, includeTax12, includeTax1, rtsForecastPct]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData({ silent: true });
      }
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedMappings.join('|'), excludeCanceled, excludeRestocking]);

  // Realtime refetch on marketing update events (reconcile_sales emits marketing:updated)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tenantId = localStorage.getItem('current_tenant_id');
    let teamId: string | null = null;
    const teamIdsRaw = localStorage.getItem('current_team_ids');
    const singleTeam = localStorage.getItem('current_team_id');
    if (teamIdsRaw) {
      try {
        const parsed = JSON.parse(teamIdsRaw);
        if (Array.isArray(parsed) && parsed.length === 1) {
          teamId = parsed[0];
        }
      } catch {
        // ignore
      }
    } else if (singleTeam && singleTeam !== 'ALL_TEAMS') {
      teamId = singleTeam;
    }
    if (!tenantId) return;
    const socket = workflowSocket.connect();
    socket.emit('subscribe:tenant', { tenantId, teamId });
    const handler = (payload: any) => {
      if (!payload || payload.tenantId !== tenantId) return;
      if (teamId && payload.teamId && payload.teamId !== teamId) return;
      fetchDataRef.current?.({ silent: true });
    };
    socket.on('marketing:updated', handler);
    return () => {
      socket.off('marketing:updated', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node | null;
      if (showMappingPicker && mappingPickerRef.current && target && !mappingPickerRef.current.contains(target)) {
        setShowMappingPicker(false);
      }
      const inFilter = filterMenuRef.current?.contains(target) || filterMenuContentRef.current?.contains(target);
      if (showFilterMenu && !inFilter) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMappingPicker, showFilterMenu]);

  const mappingDisplay = (val: string) => mappingDisplayMap[val.toLowerCase()] || val;
  const selectedMappingLabel =
    selectedMappings.length === mappingOptions.length
      ? 'All mappings'
      : `${selectedMappings.length} selected`;
  const isChecked = (norm: string) => selectedMappings.includes(norm);
  const isSortActive = (key: NonNullable<typeof sortKey>, dir: 'asc' | 'desc') =>
    sortKey === key && sortDir === dir;
  const sortButtonClass = (key: NonNullable<typeof sortKey>, dir: 'asc' | 'desc') =>
    `h-3 w-3 ${isSortActive(key, dir) ? 'text-slate-700' : 'text-slate-400'} hover:text-slate-600`;
  const setSort = (key: NonNullable<typeof sortKey>, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };
  const renderSortLabel = (label: ReactNode, key: NonNullable<typeof sortKey>) => (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="inline-flex flex-col -space-y-1 leading-none">
        <button
          type="button"
          aria-label={`Sort ${String(label)} high to low`}
          onClick={() => setSort(key, 'desc')}
          className="leading-none"
        >
          <ChevronUp className={sortButtonClass(key, 'desc')} />
        </button>
        <button
          type="button"
          aria-label={`Sort ${String(label)} low to high`}
          onClick={() => setSort(key, 'asc')}
          className="leading-none"
        >
          <ChevronDown className={sortButtonClass(key, 'asc')} />
        </button>
      </span>
    </span>
  );

  const computedKpis = data
    ? (() => {
        const adjustedGrossCod = computeAdjustedGrossCod(data.kpis, {
          excludeCancel: excludeCanceled,
          excludeRestocking: excludeRestocking,
        });
        const cogsTotal = data.kpis.cogs ?? 0;
        const cogsCanceled = excludeCanceled ? data.kpis.cogs_canceled ?? 0 : 0;
        const cogsRestocking = excludeRestocking ? data.kpis.cogs_restocking ?? 0 : 0;
        const cogsAdjusted = cogsTotal - cogsCanceled - cogsRestocking;
        return {
          ...data.kpis,
          rts_pct: computeRtsPctFromCounts(data.counts),
          cm_rts_forecast: computeCmRtsForecast({
            codRaw: adjustedGrossCod,
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
        });
        const cogsTotal = data.prevKpis.cogs ?? 0;
        const cogsCanceled = excludeCanceled ? data.prevKpis.cogs_canceled ?? 0 : 0;
        const cogsRestocking = excludeRestocking ? data.prevKpis.cogs_restocking ?? 0 : 0;
        const cogsAdjusted = cogsTotal - cogsCanceled - cogsRestocking;
        return {
          ...data.prevKpis,
          rts_pct: computeRtsPctFromCounts(data.prevCounts),
          cm_rts_forecast: computeCmRtsForecast({
            codRaw: adjustedGrossCod,
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
  const sortableProducts = products.map((row, index) => {
    const norm = (row.mapping || '__null__').toLowerCase();
    const display = row.mapping ? (mappingDisplayMap[norm] || row.mapping) : 'Unassigned';
    const codRaw = row.cod_raw ?? row.revenue ?? 0;
    const sf = row.sf_raw ?? row.sf_fees ?? 0;
    const ff = row.ff_raw ?? row.ff_fees ?? 0;
    const iF = row.if_raw ?? row.if_fees ?? 0;
    const codFeeDelivered = row.cod_fee_delivered_raw ?? row.cod_fee_delivered ?? 0;
    const cogsTotal = row.cogs ?? 0;
    const cogsCanceled = row.cogs_ec != null ? Math.max(0, cogsTotal - row.cogs_ec) : 0;
    const cogsRestocking = row.cogs_restocking ?? 0;
    const cogsAdjusted =
      cogsTotal -
      (excludeCanceled ? cogsCanceled : 0) -
      (excludeRestocking ? cogsRestocking : 0);
    const cogsRts = row.cogs_rts ?? 0;
    const forecast = computeCmRtsForecast({
      codRaw,
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

  const metricValues = data
    ? metricDefinitions.map((def) => {
        const current = computedKpis?.[def.key] ?? 0;
        const previous = computedPrevKpis?.[def.key] ?? 0;
        const delta = formatDelta(current, previous);
        const countCurrent = def.countKey ? data.counts?.[def.countKey] ?? 0 : null;
        const countPrev = def.countKey ? data.prevCounts?.[def.countKey] ?? 0 : null;
        const countDelta = def.countKey ? formatDelta(countCurrent ?? 0, countPrev ?? 0) : null;
        return { ...def, current, previous, delta, countCurrent, countPrev, countDelta };
      })
    : [];

  const leftCard = metricValues.find((m) => m.key === 'revenue');
  const rightCard = metricValues.find((m) => m.key === 'ad_spend');
  const middleCards = metricValues.filter((m) => m.key !== 'revenue' && m.key !== 'ad_spend');

  const secondaryCards =
    data
      ? secondaryMetricDefinitions.map((def) => {
          const current = computedKpis?.[def.key] ?? 0;
          const previous = computedPrevKpis?.[def.key] ?? 0;
          const delta = formatDelta(current, previous);
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
  const leftSecondary = secondaryCards.find((m) => m.key === 'cm_rts_forecast');
  const fixedRightSecondary = secondaryCards.filter(
    (m) => m.key === 'contribution_margin' || m.key === 'net_margin',
  );
  const middleSecondary = secondaryCards.filter(
    (m) =>
      m.key !== 'cm_rts_forecast' &&
      m.key !== 'contribution_margin' &&
      m.key !== 'net_margin',
  );

  const buildCmTooltip = (kpis: OverviewResponse['kpis'] | undefined): ReactNode | null => {
    if (!kpis) return null;
    const nf = (v: number) => formatValue(v, 'currency');
    const neg = (v: number) => (v === 0 ? nf(0) : `- ${nf(Math.abs(v))}`);
    const pos = (v: number) => (v === 0 ? nf(0) : `+ ${nf(Math.abs(v))}`);
    const fulfillment = (kpis.sf_fees ?? 0) + (kpis.ff_fees ?? 0) + (kpis.if_fees ?? 0);
    const canceledCodAdj = excludeCanceled ? kpis.canceled_cod ?? 0 : 0;
    const restockingCodAdj = excludeRestocking ? kpis.restocking_cod ?? 0 : 0;
    const rtsCodAdj = excludeRts ? kpis.rts_cod ?? 0 : 0;
    const excludedCogsCanceled = excludeCanceled ? kpis.cogs_canceled ?? 0 : 0;
    const excludedCogsRestocking = excludeRestocking ? kpis.cogs_restocking ?? 0 : 0;
    const excludedCogsRts = excludeRts ? kpis.cogs_rts ?? 0 : 0;
    const cogsIncluded =
      (kpis.cogs ?? 0) - excludedCogsCanceled - excludedCogsRestocking - excludedCogsRts;
    const filtersLabel = [
      `${startDate} → ${endDate}`,
      `${selectedMappings.length || 0}/${mappingOptions.length || 0} mappings`,
      `Exclude: cancel ${excludeCanceled ? 'ON' : 'OFF'}, restocking ${excludeRestocking ? 'ON' : 'OFF'}, RTS ${excludeRts ? 'ON' : 'OFF'}`,
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
        <div className="flex justify-between text-slate-600 text-[11px]">
          <span>SF Fees</span>
          <span>{neg(kpis.sf_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-600 text-[11px]">
          <span>FF Fees</span>
          <span>{neg(kpis.ff_fees ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-600 text-[11px]">
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
          <span>COGS (all)</span>
          <span>{neg(kpis.cogs ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span className="flex items-center gap-1">
            COGS used in CM
          </span>
          <span>{neg(cogsIncluded)}</span>
        </div>
        <div className="flex justify-between text-slate-700 text-[12px]">
          <span>+ COGS Canceled</span>
          <span>{pos(excludedCogsCanceled)}</span>
        </div>
        <div className="flex justify-between text-slate-700 text-[12px]">
          <span>+ COGS Restocking</span>
          <span>{pos(excludedCogsRestocking)}</span>
        </div>
        <div className="flex justify-between text-slate-700 text-[12px]">
          <span>+ RTS COGS</span>
          <span>{pos(excludedCogsRts)}</span>
        </div>
        <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-1 font-semibold">
          <span>Contribution Margin</span>
          <span>{nf(kpis.contribution_margin ?? 0)}</span>
        </div>
        <p className="text-[11px] text-slate-500">{filtersLabel}</p>
      </div>
    );
  };

  const buildNmTooltip = (kpis: OverviewResponse['kpis'] | undefined): ReactNode | null => {
    if (!kpis) return null;
    const nf = (v: number) => formatValue(v, 'currency');
    const neg = (v: number) => (v === 0 ? nf(0) : `- ${nf(Math.abs(v))}`);
    const filtersLabel = [
      `${startDate} → ${endDate}`,
      `${selectedMappings.length || 0}/${mappingOptions.length || 0} mappings`,
      `Exclude: cancel ${excludeCanceled ? 'ON' : 'OFF'}, restocking ${excludeRestocking ? 'ON' : 'OFF'}, RTS ${excludeRts ? 'ON' : 'OFF'}`,
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
        <p className="text-[11px] text-slate-500">{filtersLabel}</p>
      </div>
    );
  };

  const buildCmRtsTooltip = (kpis: OverviewResponse['kpis'] | undefined): ReactNode | null => {
    if (!kpis) return null;
    const nf = (v: number) => formatValue(v, 'currency');
    const neg = (v: number) => (v === 0 ? nf(0) : `- ${nf(Math.abs(v))}`);
    const pos = (v: number) => (v === 0 ? nf(0) : `+ ${nf(Math.abs(v))}`);
    const cogsTotal = kpis.cogs ?? 0;
    const cogsCanceled = excludeCanceled ? kpis.cogs_canceled ?? 0 : 0;
    const cogsRestocking = excludeRestocking ? kpis.cogs_restocking ?? 0 : 0;
    const cogsAdjusted = cogsTotal - cogsCanceled - cogsRestocking;
    const canceledCodAdj = excludeCanceled ? kpis.canceled_cod ?? 0 : 0;
    const restockingCodAdj = excludeRestocking ? kpis.restocking_cod ?? 0 : 0;
    const adjustedGrossCod = computeAdjustedGrossCod(kpis, {
      excludeCancel: excludeCanceled,
      excludeRestocking: excludeRestocking,
    });
    const forecast = computeCmRtsForecast({
      codRaw: adjustedGrossCod,
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
      `Exclude: cancel ${excludeCanceled ? 'ON' : 'OFF'}, restocking ${excludeRestocking ? 'ON' : 'OFF'}`,
      `RTS %: ${rtsForecastSafe}`,
    ].join(' • ');

    return (
      <div className="space-y-1">
        <p className="font-semibold text-slate-800">CM (RTS {rtsForecastSafe}%) inputs</p>
        <div className="flex justify-between text-slate-800">
          <span>Gross COD (raw)</span>
          <span>{nf(kpis.gross_cod ?? 0)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>Canceled COD</span>
          <span>{neg(canceledCodAdj)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>Restocking COD</span>
          <span>{neg(restockingCodAdj)}</span>
        </div>
        <div className="flex justify-between text-slate-800 border-t border-slate-100 pt-1">
          <span>Gross COD (adjusted)</span>
          <span>{nf(adjustedGrossCod)}</span>
        </div>
        <div className="flex justify-between text-slate-800">
          <span>RTS forecast ({rtsForecastSafe}%)</span>
          <span>{neg((kpis.gross_cod ?? 0) * forecast.rtsFraction)}</span>
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
        <p className="text-[11px] text-slate-500">{filtersLabel}</p>
      </div>
    );
  };

  const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollStripRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollStripRef.current.scrollLeft += e.deltaY;
    }
  };

  const renderCard = (m: (typeof metricValues)[number]) => {
    const delta = m.delta;
    const deltaLabel = delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
    const deltaColor =
      delta === null ? 'text-slate-400' : delta >= 0 ? 'text-emerald-600' : 'text-rose-500';
    const countDeltaLabel =
      m.countDelta === null || m.countDelta === undefined
        ? null
        : `${m.countDelta > 0 ? '+' : ''}${m.countDelta.toFixed(1)}%`;
    const countDeltaColor =
          m.countDelta === null || m.countDelta === undefined
        ? 'text-slate-400'
        : m.countDelta >= 0
          ? 'text-emerald-600'
          : 'text-rose-500';
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
      <div
        key={m.key}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 min-w-[190px]"
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
        <div className="mt-1 flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">
            {formatValue(m.current, m.format, m.format === 'percent' ? 1 : 2)}
          </p>
          <p className={`text-[11px] ${deltaColor}`}>{deltaLabel}</p>
        </div>
        {m.countKey && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm text-slate-700">
              <span className="font-normal text-slate-600">ord:</span>{' '}
              <span className="font-semibold text-slate-900">
                {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(m.countCurrent ?? 0)}
              </span>
            </span>
            <span className={`text-[11px] ${countDeltaColor}`}>
              {countDeltaLabel ?? '--'}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Analytics"
        description="Monitor sales performance by mapping."
      />

      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <p className="text-lg font-semibold text-slate-900">Sales Monitoring</p>
          </div>
          <p className="text-sm text-slate-400">
            Last updated: <span className="font-medium text-slate-600">{data?.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : '—'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Mapping</p>
            <div className="relative" ref={mappingPickerRef}>
              <button
                type="button"
                onClick={() => setShowMappingPicker((p) => !p)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none"
              >
                <span className="text-slate-900">{selectedMappingLabel}</span>
                <span className="text-slate-400 text-xs">(click to choose)</span>
              </button>
              {showMappingPicker && (
                <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 border-b border-slate-100">
                    <span>Select mappings</span>
                    <button
                      type="button"
                      onClick={() => setSelectedMappings([])}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={mappingSearch}
                      onChange={(e) => setMappingSearch(e.target.value)}
                      placeholder="Type to search"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            mappingOptions.length > 0 &&
                            selectedMappings.length === mappingOptions.length
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedMappings(checked ? mappingOptions : []);
                            setShowMappingPicker(true);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>All</span>
                      </label>
                    </div>
                    {mappingOptions
                      .filter((m) =>
                        mappingSearch.trim()
                          ? mappingDisplay(m).toLowerCase().includes(mappingSearch.toLowerCase())
                          : true,
                      )
                      .map((mapping) => {
                        const norm = mapping.toLowerCase();
                        const checked = isChecked(norm);
                        return (
                          <div
                            key={mapping}
                            className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedMappings((prev) =>
                                    prev.includes(norm)
                                      ? prev.filter((v) => v !== norm)
                                      : [...prev, norm],
                                  );
                                  setShowMappingPicker(true);
                                }}
                                className="rounded border-slate-300"
                              />
                              <span>{titleCase(mappingDisplay(mapping))}</span>
                            </label>
                            <button
                              type="button"
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                              onClick={() => {
                                setSelectedMappings([norm]);
                                setShowMappingPicker(true);
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
              <div className="relative" ref={filterMenuRef}>
                <Datepicker
                  value={range}
                  onChange={(val: any) => {
                    const nextStart = val?.startDate || today;
                    const nextEnd = val?.endDate || today;
                    setRange({ startDate: nextStart, endDate: nextEnd });
                    // Format dates as YYYY-MM-DD strings for API
                    const formatDate = (d: any) => {
                      if (!d) return today;
                      if (typeof d === 'string') return d.slice(0, 10);
                      if (d instanceof Date) return d.toISOString().slice(0, 10);
                      return today;
                    };
                    setStartDate(formatDate(nextStart));
                    setEndDate(formatDate(nextEnd));
                  }}
                  inputClassName="rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-300"
                  containerClassName=""
                  displayFormat="MM/DD/YYYY"
                  separator=" – "
                  toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  placeholder=""
                />
              </div>
              <div className="relative" ref={filterMenuContentRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterMenu((p) => !p)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 bg-white hover:border-slate-300"
                  aria-label="Filters"
                >
                  <Filter className="h-4 w-4" />
                </button>
                {canShare && (
                  <button
                    type="button"
                    onClick={openShareModal}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 bg-white hover:border-slate-300 ml-2"
                    aria-label="Share analytics"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                )}
                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg z-30 p-3 space-y-3">
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
                      <p className="text-[11px] text-slate-500">Used for CM (RTS %) forecast column</p>
                    </div>
                    <div className="h-px bg-slate-100 my-1" />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={includeTax12}
                        onChange={(e) => setIncludeTax12(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Include 12% Ads Tax</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={includeTax1}
                        onChange={(e) => setIncludeTax1(e.target.checked)}
                      />
                      <span className="text-sm text-slate-800">Include 1% Ads Tax</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mt-4">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          {isLoading ? (
            <div className="flex gap-3 w-full">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 animate-pulse min-w-[180px]">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="mt-1.5 h-5 w-16 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {leftCard && renderCard(leftCard)}
              <div
                className="flex-1 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 [&::-webkit-scrollbar]:hidden [scrollbar-width:'none']"
                ref={scrollStripRef}
                onWheel={handleWheelScroll}
              >
                <div className="flex gap-3 min-w-full">
                  {middleCards.map((m) => renderCard(m))}
                </div>
              </div>
              {rightCard && renderCard(rightCard)}
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {isLoading ? (
            <div className="flex gap-3 w-full">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`sec-skel-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 animate-pulse min-w-[190px]">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="mt-1.5 h-5 w-16 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {leftSecondary && renderCard(leftSecondary)}
              <div
                className="flex-1 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 [&::-webkit-scrollbar]:hidden [scrollbar-width:'none']"
                onWheel={handleWheelScroll}
              >
                <div className="flex gap-3 min-w-full">
                  {middleSecondary.map((m) => renderCard(m))}
                </div>
              </div>
              {fixedRightSecondary.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                  {fixedRightSecondary.map((m) => renderCard(m))}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Revenue per Product (Mapping) */}
      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3 px-2">
          <h2 className="text-lg font-semibold text-slate-900">Revenue per Product</h2>
        </div>
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 w-16 bg-slate-50 px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('#', 'index')}
                  </th>
                  <th className="sticky left-16 z-10 bg-slate-50 px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Product', 'product')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Gross Revenue', 'revenue')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Gross Sales', 'gross_sales')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('COGS', 'cogs')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('AOV', 'aov')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('CPP', 'cpp')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Processed CPP', 'processed_cpp')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Ad Spend', 'ad_spend')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('AR %', 'ar_pct')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('RTS %', 'rts_pct')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('P.E %', 'profit_efficiency')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Contribution Margin', 'contribution_margin')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel(`CM (RTS ${rtsForecastSafe}% )`, 'cm_rts_forecast')}
                  </th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {renderSortLabel('Net Margin', 'net_margin')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`prod-skel-${idx}`}>
                        {Array.from({ length: 15 }).map((__, cIdx) => (
                          <td key={cIdx} className="px-3 sm:px-4 lg:px-6 py-3">
                            <div className="h-3 w-16 bg-slate-200 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : pagedProducts.map((item, idx) => {
                      const { row, derived } = item;
                      const { display, forecast, rtsPct, sf, ff, iF, codFeeDelivered, cogsAdjusted, cogsRts } = derived;

                      return (
                        <tr key={`${row.mapping || 'null'}-${idx}`} className="hover:bg-slate-50">
                          <td className="sticky left-0 z-10 w-16 bg-white px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {(productPage - 1) * pageSize + idx + 1}.
                          </td>
                          <td className="sticky left-16 z-10 bg-white px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                            {titleCase(display)}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.revenue, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.gross_sales, 'number', 0)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.cogs, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.aov, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.cpp, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.processed_cpp, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.ad_spend, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.ar_pct, 'percent', 1)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(rtsPct, 'percent', 1)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.profit_efficiency, 'percent', 1)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.contribution_margin, 'currency')}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">
                            <span
                              title={`CM (RTS ${rtsForecastSafe}%): ${(formatValue(forecast.revenueAfterRts,'currency'))} - ${(formatValue(row.ad_spend ?? 0,'currency'))} - ${(formatValue(sf,'currency'))} - ${(formatValue(ff,'currency'))} - ${(formatValue(iF,'currency'))} - ${(formatValue(codFeeDelivered,'currency'))} - ${(formatValue(cogsAdjusted,'currency'))} + ${(formatValue(cogsRts,'currency'))} = ${(formatValue(forecast.cmForecast,'currency'))}`}
                            >
                              {formatValue(forecast.cmForecast, 'currency')}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-center text-slate-700 whitespace-nowrap">{formatValue(row.net_margin, 'currency')}</td>
                        </tr>
                      );
                    })}
                {!isLoading && products.length === 0 && (
                  <tr>
                    <td className="px-3 sm:px-4 lg:px-6 py-4 text-center text-slate-500" colSpan={15}>
                      No products found for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <p className="text-sm text-slate-600">
              Showing {productStart}-{productEnd} of {totalProducts}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                disabled={!productCanPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
                disabled={!productCanNext || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Sales Analytics</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {shareLoading ? (
              <p className="text-sm text-slate-600">Loading teams…</p>
            ) : shareTeams.length === 0 ? (
              <p className="text-sm text-slate-600">No teams available to share.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shareTeams
                  .filter((t) => t.id !== currentTeamId)
                  .map((team) => (
                    <label key={team.id} className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={shareSelected.includes(team.id)}
                        onChange={() => toggleShareTeam(team.id)}
                      />
                      <span>{team.name}</span>
                    </label>
                  ))}
                {shareTeams.filter((t) => t.id !== currentTeamId).length === 0 && (
                  <p className="text-sm text-slate-600">No other teams to share with.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <button
              onClick={() => setShareOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
              disabled={shareSaving}
            >
              Cancel
            </button>
            <button
              onClick={saveShare}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
              disabled={shareSaving}
            >
              {shareSaving ? 'Saving…' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
