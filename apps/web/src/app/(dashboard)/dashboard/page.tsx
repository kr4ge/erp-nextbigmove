'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, MetricCard } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/emptystate';
import {
  BarChart3,
  LinkIcon,
  StoreIcon,
  Zap,
  Users,
  TrendingUp,
  CheckCircle2,
  Filter,
  Coins,
  PieChart,
  Lightbulb,
  Boxes,
  DollarSignIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const Datepicker = dynamic(() => import('react-tailwindcss-datepicker'), { ssr: false });
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

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

const normalizePickerDate = (value: any) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return parseYmdToLocalDate(value.slice(0, 10));
  return null;
};

interface DashboardStats {
  integrationCount: number;
  totalUsers: number;
}

type MyStats = {
  ad_spend: number;
  ar: number;
  winning_creatives: number;
  creatives_created: number;
  overall_ranking: number | null;
  winning_creatives_list?: { adId: string | null; adName: string | null }[];
};

type SalesDashboardRow = {
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
  salesVsMktgPct: number;
  confirmationRatePct: number;
  rtsRatePct: number;
  pendingRatePct: number;
  cancellationRatePct: number;
  upsellRatePct: number;
};

type SalesDashboardSummary = {
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

type SalesDashboardResponse = {
  summary: SalesDashboardSummary;
  prevSummary: SalesDashboardSummary;
  rows: SalesDashboardRow[];
  filters: {
    shops: string[];
    shopDisplayMap?: Record<string, string>;
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
  };
  rangeDays: number;
  lastUpdatedAt: string | null;
};

type SunburstNode = {
  name: string;
  value: number;
  children?: SunburstNode[];
};

type ProblematicDeliveryResponse = {
  data: SunburstNode[];
  total: number;
  trend: Array<{
    date: string;
    delivered_count: number;
    rts_count: number;
  }>;
  undeliverableAllTime?: {
    count: number;
    totalCod: number;
  };
  undeliverableTrend?: Array<{
    date: string;
    count: number;
  }>;
  onDeliveryAllTime?: {
    count: number;
    totalCod: number;
  };
  onDeliveryTrend?: Array<{
    date: string;
    count: number;
  }>;
  filters: {
    shops: string[];
    shopDisplayMap?: Record<string, string>;
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
    sales_assignee?: string | null;
  };
  lastUpdatedAt: string | null;
};

type SunburstHoverInfo = {
  path: string;
  orders: number;
  pct: number;
  color: string;
};

const salesMetricDefinitions: {
  key: keyof SalesDashboardSummary;
  label: string;
  format: 'currency' | 'percent' | 'number';
}[] = [
  { key: 'mktg_cod', label: 'MKTG Cod (₱)', format: 'currency' },
  { key: 'sales_cod', label: 'Sales Cod (₱)', format: 'currency' },
  { key: 'sales_vs_mktg_pct', label: 'SMP %', format: 'percent' },
  { key: 'rts_rate_pct', label: 'RTS Rate (%)', format: 'percent' },
  { key: 'confirmation_rate_pct', label: 'Confirmation Rate (%)', format: 'percent' },
  { key: 'pending_rate_pct', label: 'Pending Rate (%)', format: 'percent' },
  { key: 'cancellation_rate_pct', label: 'Cancellation Rate (%)', format: 'percent' },
  { key: 'upsell_rate_pct', label: 'Upsell Rate (%)', format: 'percent' },
];

const formatCount = (val?: number) => new Intl.NumberFormat('en-US').format(val ?? 0);

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
    formatter: (params: any) => {
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

export default function DashboardPage() {
  const today = useMemo(() => formatDateInTimezone(new Date()), []);
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    integrationCount: 0,
    totalUsers: 1,
  });
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [range, setRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  });
  const [perms, setPerms] = useState<string[]>([]);
  const [excludeCancel, setExcludeCancel] = useState(true);
  const [excludeRestocking, setExcludeRestocking] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showAllWinning, setShowAllWinning] = useState(false);
  const [excludeRts, setExcludeRts] = useState(true);
  const [includeTax12, setIncludeTax12] = useState(false);
  const [includeTax1, setIncludeTax1] = useState(false);
  const [execStats, setExecStats] = useState<any>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState('');
  const [teamCode, setTeamCode] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [teamCodeLoading, setTeamCodeLoading] = useState(false);
  const [nameTab, setNameTab] = useState<'ads' | 'campaign'>('ads');
  const [adsInputs, setAdsInputs] = useState<{ f1: string; f2: string; f5: string }>({ f1: '', f2: '', f5: '' });
  const [campaignInputs, setCampaignInputs] = useState<{
    type: string;
    emp: string;
    shop: string;
    product: string;
    mapping: string;
    date: string;
  }>({ type: '', emp: '', shop: '', product: '', mapping: '', date: '' });
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameResult, setNameResult] = useState<string>('');
  const [leaderStats, setLeaderStats] = useState<{ team_ad_spend: number; team_ar: number; team_overall_ranking: number | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLDivElement | null>(null);
  const [salesRange, setSalesRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: parseYmdToLocalDate(today),
    endDate: parseYmdToLocalDate(today),
  });
  const [salesStartDate, setSalesStartDate] = useState(today);
  const [salesEndDate, setSalesEndDate] = useState(today);
  const [salesData, setSalesData] = useState<SalesDashboardResponse | null>(null);
  const [salesProblematicData, setSalesProblematicData] = useState<ProblematicDeliveryResponse | null>(null);
  const [salesSunburstHoverInfo, setSalesSunburstHoverInfo] = useState<SunburstHoverInfo | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [shopOptions, setShopOptions] = useState<string[]>([]);
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [isAllShopsMode, setIsAllShopsMode] = useState(true);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  const [hasInitializedShopSelection, setHasInitializedShopSelection] = useState(false);
  const shopPickerRef = useRef<HTMLDivElement | null>(null);
  const lastSalesSunburstHoverKeyRef = useRef<string>('');

  const canViewMarketingDashboard = useMemo(() => {
    return perms.includes('dashboard.marketing');
  }, [perms]);

  const canViewMarketingLeader = useMemo(() => perms.includes('dashboard.marketing_leader'), [perms]);
  const canViewExecutives = useMemo(() => perms.includes('dashboard.executives'), [perms]);
  const canViewSalesDashboard = useMemo(() => perms.includes('dashboard.sales'), [perms]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const tenantStr = localStorage.getItem('tenant');

    if (userStr) setUser(JSON.parse(userStr));
    if (tenantStr) setTenant(JSON.parse(tenantStr));
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await apiClient.get('/integrations', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setStats((prev) => ({
          ...prev,
          integrationCount: Array.isArray(response.data) ? response.data.length : 0,
        }));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Fetch permissions to ensure gating reflects latest assignments
  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const res = await apiClient.get('/auth/permissions');
        const p: string[] = res?.data?.permissions || [];
        setPerms(p);
      } catch {
        setPerms((prev) => prev); // keep whatever we had
      }
    };
    fetchPerms();
  }, []);

  useEffect(() => {
    setNameError(null);
    setNameResult('');
  }, [nameTab]);

  // Close filter dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        showFilterMenu &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(e.target as Node)
      ) {
        setShowFilterMenu(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [showFilterMenu]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        showShopPicker &&
        shopPickerRef.current &&
        !shopPickerRef.current.contains(e.target as Node)
      ) {
        setShowShopPicker(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [showShopPicker]);

  // Fetch team code for name convention (uses my-teams)
  useEffect(() => {
    const fetchTeamCode = async () => {
      if (!canViewMarketingDashboard && !canViewMarketingLeader && !canViewExecutives) return;
      setTeamCodeLoading(true);
      try {
        const res = await apiClient.get('/teams/my-teams');
        const list: any[] = res.data || [];
        const stored = localStorage.getItem('current_team_id');
        const chosen = (stored && list.find((t) => t.id === stored)) || list[0];
        if (chosen?.teamCode) setTeamCode(chosen.teamCode);
        if (chosen?.name) setTeamName(chosen.name);
      } catch {
        // ignore
      } finally {
        setTeamCodeLoading(false);
      }
    };
    fetchTeamCode();
  }, [canViewMarketingDashboard, canViewMarketingLeader, canViewExecutives]);

  useEffect(() => {
    const fetchExecStats = async () => {
      if (!canViewExecutives) return;
      setExecLoading(true);
      setExecError('');
      try {
        const params: any = {};
        if (range.startDate) params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate) params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        params.exclude_rts = excludeRts;
        params.include_tax_12 = includeTax12;
        params.include_tax_1 = includeTax1;
        const res = await apiClient.get('/analytics/sales/executive-overview', { params });
        const kpis = res.data?.kpis || null;
        const counts = res.data?.counts || {};
        setExecStats(kpis ? { ...kpis, purchases: counts.purchases ?? 0 } : null);
      } catch (err: any) {
        setExecError(err?.response?.data?.message || 'Failed to load executive stats');
      } finally {
        setExecLoading(false);
      }
    };
    fetchExecStats();
  }, [canViewExecutives, range.startDate, range.endDate, excludeCancel, excludeRestocking, excludeRts, includeTax12, includeTax1]);

  useEffect(() => {
    const fetchMyStats = async () => {
      const canView = perms.includes('dashboard.marketing') || perms.includes('dashboard.marketing_leader');
      if (!canView) return;
      setStatsLoading(true);
      setError('');
    try {
      const params: any = {};
      if (range.startDate) params.start_date = formatDateInTimezone(range.startDate);
      if (range.endDate) params.end_date = formatDateInTimezone(range.endDate);
      params.exclude_cancel = excludeCancel;
      params.exclude_restocking = excludeRestocking;
      const res = await apiClient.get('/analytics/marketing/my-stats', { params });
      if (res.data?.kpis) {
        setMyStats({
          ...res.data.kpis,
          winning_creatives_list: res.data?.winning_creatives_list || [],
        });
      } else {
        setMyStats(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load your stats');
      setMyStats(null);
    } finally {
      setStatsLoading(false);
      }
    };

    fetchMyStats();
  }, [perms, range.startDate, range.endDate, excludeCancel, excludeRestocking]);

  useEffect(() => {
    const fetchLeaderStats = async () => {
      if (!canViewMarketingLeader) return;
      setStatsLoading(true);
      setError('');
      try {
        const params: any = {};
        if (range.startDate) params.start_date = formatDateInTimezone(range.startDate);
        if (range.endDate) params.end_date = formatDateInTimezone(range.endDate);
        params.exclude_cancel = excludeCancel;
        params.exclude_restocking = excludeRestocking;
        if (teamCode) params.team_code = teamCode;
        const res = await apiClient.get('/analytics/marketing/leader-stats', { params });
        setLeaderStats(res.data || null);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load leader stats');
        setLeaderStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchLeaderStats();
  }, [canViewMarketingLeader, range.startDate, range.endDate, excludeCancel, excludeRestocking, teamCode]);

  const resolvedShopSelection = useMemo(
    () => (isAllShopsMode ? shopOptions : selectedShops),
    [isAllShopsMode, selectedShops, shopOptions],
  );
  const isAllShopsSelected = isAllShopsMode;
  const selectedShopLabel =
    isAllShopsSelected
      ? 'All shops'
      : `${selectedShops.length} selected`;
  const filteredShopOptions = useMemo(
    () =>
      shopOptions.filter((value) =>
        shopSearch.trim()
          ? (salesData?.filters?.shopDisplayMap?.[value] || value)
              .toLowerCase()
              .includes(shopSearch.toLowerCase())
          : true,
      ),
    [shopOptions, shopSearch, salesData?.filters?.shopDisplayMap],
  );

  useEffect(() => {
    const fetchSalesDashboard = async () => {
      if (!canViewSalesDashboard) return;
      setSalesSunburstHoverInfo(null);
      lastSalesSunburstHoverKeyRef.current = '';
      setSalesLoading(true);
      try {
        const params: any = {};
        params.start_date = salesStartDate;
        params.end_date = salesEndDate;
        if (!isAllShopsMode) {
          params.shop_id = selectedShops.length > 0 ? selectedShops : ['__no_selection__'];
        }
        const [statsRes, problematicRes] = await Promise.all([
          apiClient.get<SalesDashboardResponse>('/analytics/sales-performance/my-stats', { params }),
          apiClient.get<ProblematicDeliveryResponse>('/analytics/sales-performance/my-problematic-delivery', { params }),
        ]);

        setSalesData(statsRes.data);
        setSalesProblematicData(problematicRes.data);

        const shops = statsRes.data?.filters?.shops || [];
        setShopOptions(shops);
        if (!hasInitializedShopSelection) {
          setIsAllShopsMode(true);
          setSelectedShops([]);
          setHasInitializedShopSelection(true);
        } else if (isAllShopsMode) {
          setSelectedShops([]);
        } else {
          const allowed = new Set(shops);
          setSelectedShops((prev) => prev.filter((v) => allowed.has(v)));
        }
      } catch (err) {
        console.error('Failed to load sales dashboard', err);
        setSalesProblematicData(null);
      } finally {
        setSalesLoading(false);
      }
    };
    fetchSalesDashboard();
  }, [
    canViewSalesDashboard,
    salesStartDate,
    salesEndDate,
    selectedShops.join('|'),
    isAllShopsMode,
    hasInitializedShopSelection,
  ]);

  const accountStatus = useMemo(() => {
    const raw = (tenant?.status || 'Unknown').toString();
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }, [tenant]);

  const displayName = useMemo(() => {
    if (!user) return 'there';
    const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return name || user?.email || 'there';
  }, [user]);

  const formatCurrency = (val?: number) =>
    typeof val === 'number'
      ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(val)
      : '—';
  const formatNumber = (val?: number) => (typeof val === 'number' ? new Intl.NumberFormat('en-US').format(val) : '—');
  const formatPercent = (val?: number) => (typeof val === 'number' ? `${val.toFixed(1)}%` : '—');
  const formatSalesValue = (val: number, format: 'currency' | 'percent' | 'number') => {
    if (!Number.isFinite(val)) return '—';
    if (format === 'currency') {
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(val);
    }
    if (format === 'percent') {
      return `${val.toFixed(2)}%`;
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  };
  const formatSalesDelta = (current: number, previous: number) => {
    if (!Number.isFinite(previous) || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const salesMetrics = useMemo(() => {
    return salesMetricDefinitions.map((def) => {
      const current = salesData?.summary?.[def.key] ?? 0;
      const previous = salesData?.prevSummary?.[def.key] ?? 0;
      return {
        ...def,
        current,
        previous,
        delta: formatSalesDelta(current, previous),
      };
    });
  }, [salesData]);

  const salesSunburstSeriesData = useMemo(() => {
    const baseHues = [24, 205, 142, 268, 347, 192, 48, 285];
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const tone = (hue: number, saturation: number, lightness: number) =>
      `hsl(${hue}, ${clamp(saturation, 35, 95)}%, ${clamp(lightness, 20, 88)}%)`;

    return (salesProblematicData?.data || []).map((l1, l1Index) => {
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
  }, [salesProblematicData?.data]);

  const salesSunburstLegend = useMemo(
    () =>
      (salesSunburstSeriesData || []).map((node: any) => ({
        name: node?.name || 'Unknown',
        count: Number(node?.value || 0),
        color: node?.itemStyle?.color || '#94A3B8',
      })),
    [salesSunburstSeriesData],
  );

  const salesSunburstOption = useMemo(
    () => ({
      tooltip: {
        show: false,
      },
      series: [
        {
          type: 'sunburst',
          radius: ['2%', '94%'],
          data: salesSunburstSeriesData,
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
    [salesSunburstSeriesData],
  );

  const salesSunburstEvents = useMemo(
    () => ({
      mouseover: (params: any) => {
        if (params?.seriesType !== 'sunburst') return;
        const path =
          params?.treePathInfo
            ?.slice(1)
            ?.map((p: any) => p?.name)
            ?.filter((name: string | undefined) => !!name)
            ?.join(' / ') || params?.name || 'Unknown';
        const orders = Number(params?.value || 0);
        const total = Number(salesProblematicData?.total || 0);
        const pct = total > 0 ? (orders / total) * 100 : 0;
        const color = typeof params?.color === 'string' ? params.color : '#94A3B8';
        const key = `${path}|${orders}|${pct.toFixed(4)}|${color}`;
        if (lastSalesSunburstHoverKeyRef.current === key) {
          return;
        }
        lastSalesSunburstHoverKeyRef.current = key;
        setSalesSunburstHoverInfo({ path, orders, pct, color });
      },
      globalout: () => {
        if (!lastSalesSunburstHoverKeyRef.current) return;
        lastSalesSunburstHoverKeyRef.current = '';
        setSalesSunburstHoverInfo(null);
      },
    }),
    [salesProblematicData?.total],
  );

  const salesTrendChartData = useMemo(() => {
    const trend = salesProblematicData?.trend || [];
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
  }, [salesProblematicData?.trend]);

  const salesTrendLineOption = useMemo(() => {
    const { labels, delivered, rts } = salesTrendChartData;

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
  }, [salesTrendChartData]);

  const salesUndeliverableChartData = useMemo(() => {
    const trend = salesProblematicData?.undeliverableTrend || [];
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
  }, [salesProblematicData?.undeliverableTrend]);

  const salesUndeliverableSparklineOption = useMemo(
    () =>
      buildSparklineOption(
        salesUndeliverableChartData.labels,
        salesUndeliverableChartData.counts,
        '#0EA5E9',
        'rgba(14,165,233,0.20)',
        'Undeliverable',
      ),
    [salesUndeliverableChartData],
  );

  const salesOnDeliveryChartData = useMemo(() => {
    const trend = salesProblematicData?.onDeliveryTrend || [];
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
  }, [salesProblematicData?.onDeliveryTrend]);

  const salesOnDeliverySparklineOption = useMemo(
    () =>
      buildSparklineOption(
        salesOnDeliveryChartData.labels,
        salesOnDeliveryChartData.counts,
        '#7C3AED',
        'rgba(124,58,237,0.20)',
        'On Delivery',
      ),
    [salesOnDeliveryChartData],
  );

  const generateName = () => {
    setNameError(null);
    if (nameTab === 'ads') {
      const fields = [adsInputs.f1, adsInputs.f2, teamCode, user?.employeeId || '', adsInputs.f5];
      if (fields.some((f) => !f || f.trim().length === 0)) {
        setNameError('All fields are required.');
        setNameResult('');
        return;
      }
      if (fields.some((f) => f.includes('_'))) {
        setNameError('Inputs cannot contain underscores (_).');
        setNameResult('');
        return;
      }
      const slug = fields.map((f) => f.trim()).join('_');
      setNameResult(slug);
      return;
    }

    // campaign tab
    const fields = [
      campaignInputs.type,
      campaignInputs.emp || user?.employeeId || '',
      campaignInputs.shop,
      campaignInputs.product,
      campaignInputs.mapping,
      campaignInputs.date,
    ];
    if (fields.some((f) => !f || f.trim().length === 0)) {
      setNameError('All fields are required.');
      setNameResult('');
      return;
    }
    if (fields.some((f) => f.includes('_'))) {
      setNameError('Inputs cannot contain underscores (_).');
      setNameResult('');
      return;
    }
    const slug = fields.map((f) => f.trim()).join('_');
    setNameResult(slug);
  };

  const copyNameResult = async () => {
    if (!nameResult) return;
    try {
      await navigator.clipboard.writeText(nameResult);
    } catch {
      // ignore
    }
  };

  const renderNameConvention = () => (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#0F172A]">Name Convention</h2>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm font-medium text-slate-700">
          <button
            className={`px-3 py-1 rounded-md ${nameTab === 'ads' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            onClick={() => setNameTab('ads')}
          >
            Ads
          </button>
          <button
            className={`px-3 py-1 rounded-md ${nameTab === 'campaign' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            onClick={() => setNameTab('campaign')}
          >
            Campaign
          </button>
        </div>
      </div>
      {nameTab === 'ads' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700 space-y-1">
              <span>Collection / Product Name</span>
              <input
                type="text"
                value={adsInputs.f1}
                onChange={(e) => setAdsInputs((p) => ({ ...p, f1: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Summary</span>
              <input
                type="text"
                value={adsInputs.f2}
                onChange={(e) => setAdsInputs((p) => ({ ...p, f2: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Team Code</span>
              <input
                type="text"
                value={teamCodeLoading ? 'Loading...' : teamCode}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Marketing Associate (employeeId)</span>
              <input
                type="text"
                value={user?.employeeId || ''}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1 sm:col-span-2">
              <span>Date Version</span>
              <input
                type="text"
                value={adsInputs.f5}
                onChange={(e) => setAdsInputs((p) => ({ ...p, f5: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
          </div>
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          <div className="flex items-center justify-between gap-3">
            <Button onClick={generateName}>Generate</Button>
            {nameResult && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>Result:</span>
                <span className="font-semibold break-all">{nameResult}</span>
                <button
                  type="button"
                  onClick={copyNameResult}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                  title="Copy"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-700 space-y-1">
              <span>Type</span>
              <select
                value={campaignInputs.type}
                onChange={(e) => setCampaignInputs((p) => ({ ...p, type: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              >
                <option value="">Select type</option>
                <option value="Testing">Testing</option>
                <option value="Scaling">Scaling</option>
                <option value="Repost Low Spent">Repost Low Spent</option>
                <option value="Repost Winning">Repost Winning</option>
              </select>
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Employee ID</span>
              <input
                type="text"
                value={campaignInputs.emp || user?.employeeId || ''}
                onChange={(e) => setCampaignInputs((p) => ({ ...p, emp: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Shop Name</span>
              <input
                type="text"
                value={campaignInputs.shop}
                onChange={(e) => setCampaignInputs((p) => ({ ...p, shop: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Collection / Product Name</span>
              <input
                type="text"
                value={campaignInputs.product}
                onChange={(e) => setCampaignInputs((p) => ({ ...p, product: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Mapping Code</span>
              <input
                type="text"
                value={campaignInputs.mapping}
                onChange={(e) => setCampaignInputs((p) => ({ ...p, mapping: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
            <label className="text-sm text-slate-700 space-y-1">
              <span>Date</span>
              <input
                type="text"
                value={campaignInputs.date}
                onChange={(e) => setCampaignInputs((p) => ({ ...p, date: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </label>
          </div>
          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          <div className="flex items-center justify-between gap-3">
            <Button onClick={generateName}>Generate</Button>
            {nameResult && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>Result:</span>
                <span className="font-semibold break-all">{nameResult}</span>
                <button
                  type="button"
                  onClick={copyNameResult}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                  title="Copy"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );

  const toggleShop = (value: string) => {
    if (isAllShopsMode) {
      setIsAllShopsMode(false);
      setSelectedShops(shopOptions.filter((v) => v !== value));
    } else {
      const has = selectedShops.includes(value);
      const next = has
        ? selectedShops.filter((v) => v !== value)
        : [...selectedShops, value];
      if (shopOptions.length > 0 && next.length === shopOptions.length) {
        setIsAllShopsMode(true);
        setSelectedShops([]);
      } else {
        setSelectedShops(next);
      }
    }
    setShowShopPicker(true);
  };

  const displayShop = (value: string) => {
    return salesData?.filters?.shopDisplayMap?.[value] || value;
  };

  const renderDefaultDashboard = () => (
    <>
      <PageHeader title="Dashboard" description="Welcome back! Here’s what’s happening with your business today." />
      {isLoading ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center text-[#475569] shadow-sm">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Users" value={stats.totalUsers} helper="Active this month" icon={<Users className="h-5 w-5" />} tone="default" />
            <MetricCard label="Integrations" value={stats.integrationCount} helper="Meta + POS" icon={<LinkIcon className="h-5 w-5" />} />
            <MetricCard label="Stores" value="—" helper="Connected POS stores" icon={<StoreIcon className="h-5 w-5" />} />
            <MetricCard label="Account Status" value={accountStatus} helper="Manage billing in settings" icon={<BarChart3 className="h-5 w-5" />} tone="warning" />
          </div>

          <Card className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#0F172A]">Quick Actions</h2>
                  <p className="mt-1 text-sm text-[#475569]">Move faster with these shortcuts.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Button variant="secondary" iconLeft={<LinkIcon className="h-4 w-4" />}>Connect Meta Ads</Button>
                <Button variant="secondary" iconLeft={<StoreIcon className="h-4 w-4" />}>Connect POS Store</Button>
                <Button variant="secondary" iconLeft={<Zap className="h-4 w-4" />}>Invite Team Member</Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0F172A]">Recent Activity</h2>
                <Button variant="ghost" size="sm">View all</Button>
              </div>
              <div className="space-y-3">
                {[
                  { title: 'Synced products from Agriblast PH', time: '2h ago', status: 'ACTIVE' as const },
                  { title: 'Meta access token refreshed', time: '5h ago', status: 'INFO' as const },
                  { title: 'Store added: The Book Hub', time: '1d ago', status: 'ACTIVE' as const },
                ].map((item) => (
                  <div key={item.title} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{item.title}</p>
                      <p className="mt-1 text-xs text-[#94A3B8]">{item.time}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0F172A]">Quick Links</h2>
                <Button variant="ghost" size="sm">Manage</Button>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'View Integrations', href: '/integrations' },
                  { label: 'Manage Stores', href: '/integrations/store' },
                  { label: 'Meta Accounts', href: '/integrations/meta' },
                  { label: 'Workspace Settings', href: '/settings' },
                ].map((link) => (
                  <a key={link.href} href={link.href} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                    <span>{link.label}</span>
                    <span className="text-[#94A3B8]">→</span>
                  </a>
                ))}
              </div>
            </Card>
          </div>

          <EmptyState
            title="No analytics events yet"
            description="When events arrive from your integrations, you’ll see them here."
            actionLabel="Connect an integration"
            onAction={() => (window.location.href = '/integrations')}
          />
        </>
      )}
    </>
  );

  const renderSalesDashboard = () => (
    <div className="space-y-5">
      <PageHeader
        title="Sales Dashboard"
        description="Your performance overview based on the selected date range."
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
              {salesData?.lastUpdatedAt ? new Date(salesData.lastUpdatedAt).toLocaleString() : '—'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4 mt-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Shop POS</p>
            <div className="relative" ref={shopPickerRef}>
              <button
                type="button"
                onClick={() => setShowShopPicker((p) => !p)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none"
              >
                <span className="text-slate-900">{selectedShopLabel}</span>
                <span className="text-slate-400 text-xs">(click to choose)</span>
              </button>
              {showShopPicker && (
                <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 border-b border-slate-100">
                    <span>Select shops</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAllShopsMode(true);
                        setSelectedShops([]);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      placeholder="Type to search"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAllShopsSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIsAllShopsMode(checked);
                            setSelectedShops([]);
                            setShowShopPicker(true);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>All</span>
                      </label>
                    </div>
                    {filteredShopOptions.map((value) => {
                      const checked = resolvedShopSelection.includes(value);
                      return (
                        <div
                          key={value}
                          className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleShop(value)}
                              className="rounded border-slate-300"
                            />
                            <span>{displayShop(value)}</span>
                          </label>
                          <button
                            type="button"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                            onClick={() => {
                              setIsAllShopsMode(false);
                              setSelectedShops([value]);
                              setShowShopPicker(true);
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
                  value={salesRange}
                  onChange={(val: any) => {
                    const nextStart = val?.startDate || today;
                    const nextEnd = val?.endDate || today;
                    setSalesRange({ startDate: nextStart, endDate: nextEnd });
                    const formatDate = (d: any) => {
                      if (!d) return today;
                      if (typeof d === 'string') return d.slice(0, 10);
                      if (d instanceof Date) return formatDateInTimezone(d);
                      return today;
                    };
                    setSalesStartDate(formatDate(nextStart));
                    setSalesEndDate(formatDate(nextEnd));
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
          {salesLoading
            ? Array.from({ length: salesMetricDefinitions.length }).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 animate-pulse">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="mt-1.5 h-5 w-16 bg-slate-200 rounded" />
                  <div className="mt-1 h-2.5 w-14 bg-slate-200 rounded" />
                </div>
              ))
            : salesMetrics.map((m) => {
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
                      {formatSalesValue(m.current, m.format)}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${deltaColor}`}>
                      {deltaLabel}
                      {salesData?.rangeDays ? ` from previous ${salesData.rangeDays} day${salesData.rangeDays > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                );
              })}
        </div>
      </Card>

      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3 px-2">
          <h2 className="text-lg font-semibold text-slate-900">Sales Performance</h2>
          <span className="text-xs text-slate-400">{salesData?.rows?.length || 0} rows</span>
        </div>
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
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
                {salesLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-slate-400" colSpan={10}>
                      Loading...
                    </td>
                  </tr>
                ) : salesData?.rows?.length ? (
                  salesData.rows.map((row) => (
                    <tr key={`${row.shopId}`} className="bg-white">
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        <div className="flex flex-col">
                          <span className="text-slate-900">{displayShop(row.shopId)}</span>
                          {displayShop(row.shopId) !== row.shopId && (
                            <span className="text-xs text-slate-400">{row.shopId}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        {formatCurrency(row.mktgCod)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm text-slate-700">
                        {formatCurrency(row.salesCod)}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatSalesValue(row.salesVsMktgPct, 'percent')}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatSalesValue(row.rtsRatePct, 'percent')}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatSalesValue(row.confirmationRatePct, 'percent')}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatSalesValue(row.pendingRatePct, 'percent')}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatSalesValue(row.cancellationRatePct, 'percent')}
                      </td>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatSalesValue(row.upsellRatePct, 'percent')}
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
        </div>
      </Card>

      <Card className="px-3 py-3 border-slate-200 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Delivery Monitoring</h2>
            <p className="text-xs text-slate-500">
              Scoped to your matched sales assignee and selected shops.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Total problematic orders:{' '}
            <span className="font-semibold text-slate-700">
              {formatCount(salesProblematicData?.total || 0)}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 mb-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              On Delivery
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCount(salesProblematicData?.onDeliveryAllTime?.count || 0)}
            </p>
            <p className="text-xs text-slate-500">
              COD: {formatCurrency(salesProblematicData?.onDeliveryAllTime?.totalCod || 0)}
            </p>
            <div className="mt-2 rounded-md bg-slate-50 border border-slate-100">
              {salesLoading ? (
                <div className="h-[140px] animate-pulse" />
              ) : (salesProblematicData?.onDeliveryTrend?.length || 0) > 0 ? (
                <ReactECharts option={salesOnDeliverySparklineOption} style={{ height: 140 }} />
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-slate-400">
                  No on-delivery trend data.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Undeliverable
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatCount(salesProblematicData?.undeliverableAllTime?.count || 0)}
            </p>
            <p className="text-xs text-slate-500">
              COD: {formatCurrency(salesProblematicData?.undeliverableAllTime?.totalCod || 0)}
            </p>
            <div className="mt-2 rounded-md bg-slate-50 border border-slate-100">
              {salesLoading ? (
                <div className="h-[140px] animate-pulse" />
              ) : (salesProblematicData?.undeliverableTrend?.length || 0) > 0 ? (
                <ReactECharts option={salesUndeliverableSparklineOption} style={{ height: 140 }} />
              ) : (
                <div className="h-[140px] flex items-center justify-center text-xs text-slate-400">
                  No undeliverable trend data.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-3 lg:col-span-2">
            <p className="text-sm font-semibold text-slate-700 mb-2 uppercase">RTS Reason Data</p>
            {salesLoading ? (
              <div className="h-[500px] animate-pulse rounded-md bg-slate-50" />
            ) : (salesProblematicData?.data?.length || 0) > 0 ? (
              <div className="h-[500px] flex flex-col">
                <div className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2 min-h-[84px]">
                  {salesSunburstHoverInfo ? (
                    <div className="space-y-1">
                      <div className="flex min-w-0 items-start gap-2">
                        <span
                          className="mt-1 h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: salesSunburstHoverInfo.color }}
                        />
                        <p
                          className="min-w-0 flex-1 text-sm font-medium text-slate-800 leading-5 whitespace-normal break-words"
                          title={salesSunburstHoverInfo.path}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {salesSunburstHoverInfo.path}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600">
                        Orders:{' '}
                        <span className="font-semibold text-slate-900">
                          {formatCount(salesSunburstHoverInfo.orders)}
                        </span>{' '}
                        ({salesSunburstHoverInfo.pct.toFixed(1)}%)
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Hover a chart segment to inspect details.
                    </p>
                  )}
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {salesSunburstLegend.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-[12px] text-slate-600">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-500">{formatCount(item.count)}</span>
                    </div>
                  ))}
                </div>
                <ReactECharts option={salesSunburstOption} onEvents={salesSunburstEvents} style={{ height: 460 }} />
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center text-sm text-slate-400">
                No RTS reason data.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 lg:col-span-3">
            <p className="text-sm font-semibold text-slate-700 mb-2 uppercase">Delivered vs RTS Trend</p>
            {salesLoading ? (
              <div className="h-[500px] animate-pulse rounded-md bg-slate-50" />
            ) : (salesProblematicData?.trend?.length || 0) > 0 ? (
              <ReactECharts option={salesTrendLineOption} style={{ height: 500 }} />
            ) : (
              <div className="h-[500px] flex items-center justify-center text-sm text-slate-400">
                No trend data for the selected range.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderMarketingDashboard = () => (
    <div className="space-y-6">
      {error && (
        <div className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Good day, {displayName} {teamName ? <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 align-super">{teamName}</span> : null}</h1>
          <p className="text-sm text-slate-600">This is your report based on the selected period.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Datepicker
              value={range}
              onChange={(val: any) => {
                setRange({
                  startDate: normalizePickerDate(val?.startDate),
                  endDate: normalizePickerDate(val?.endDate),
                });
              }}
              inputClassName="rounded-xl border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-300 shadow-sm"
              displayFormat="MM/DD/YYYY"
              separator=" – "
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              containerClassName=""
              popupClassName={(defaultClass) => `${defaultClass} z-50`}
            />
          </div>
          <div className="relative" ref={filterButtonRef}>
            <Button
              variant="secondary"
              size="sm"
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterMenu((p) => !p);
              }}
            >
              <Filter className="h-4 w-4" />
            </Button>
            {showFilterMenu && (
              <div
                ref={filterMenuRef}
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-20 p-3 space-y-3"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={excludeCancel}
                    onChange={(e) => setExcludeCancel(e.target.checked)}
                  />
                  Exclude canceled
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={excludeRestocking}
                    onChange={(e) => setExcludeRestocking(e.target.checked)}
                  />
                  Exclude restocking
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {statsLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading your stats…</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <MetricCard label="My Ad Spent" value={formatCurrency(myStats?.ad_spend)} icon={<Coins className="h-5 w-5 text-emerald-600" />} tone="default" />
        <MetricCard label="My AR" value={formatPercent(myStats?.ar)} icon={<PieChart className="h-5 w-5 text-red-600" />} tone="default" />
        <MetricCard label="Winning Creatives" value={formatNumber(myStats?.winning_creatives)} icon={<Lightbulb className="h-5 w-5 text-amber-500" />} tone="default" />
        <MetricCard label="Creatives Created" value={formatNumber(myStats?.creatives_created)} icon={<Zap className="h-5 w-5 text-emerald-600" />} tone="default" />
        <MetricCard label="Overall Ranking" value={myStats?.overall_ranking ?? '—'} icon={<BarChart3 className="h-5 w-5 text-blue-600" />} tone="default" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0F172A]">Winning Creatives</h2>
            {myStats?.winning_creatives_list && myStats.winning_creatives_list.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllWinning((p) => !p)}>
                {showAllWinning ? 'Collapse' : 'View all'}
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {myStats?.winning_creatives_list && myStats.winning_creatives_list.length > 0 ? (
              (showAllWinning ? myStats.winning_creatives_list : myStats.winning_creatives_list.slice(0, 3)).map((item, idx) => (
                <div key={`${item.adId || 'ad'}-${idx}`} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{item.adName || 'Unnamed creative'}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">{item.adId || 'No Ad ID'}</p>
                  </div>
                  <StatusBadge status="ACTIVE" />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No winning creatives in this range.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0F172A]">Quick Links</h2>
            <Button variant="ghost" size="sm">Manage</Button>
          </div>
          <div className="space-y-2">
            {[{ label: 'Marketer leaderboard', href: '#marketer' }, { label: 'Team leaderboard', href: '#team' }, { label: 'Marketing analytics', href: '/analytics/marketing' }].map((link) => (
              <a key={`${link.href}-${link.label}`} href={link.href} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A] hover:bg-[#F8FAFC]">
                <span>{link.label}</span>
                <span className="text-[#94A3B8]">→</span>
              </a>
            ))}
          </div>
        </Card>

      </div>

      {renderNameConvention()}
    </div>
  );

  const renderExecutiveDashboard = () => (
    <div className="space-y-6">
      {execError && (
        <div className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{execError}</div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Executive Dashboard</h1>
          <p className="text-sm text-slate-600">High-level view of sales performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Datepicker
              value={range}
              onChange={(val: any) => {
                setRange({
                  startDate: normalizePickerDate(val?.startDate),
                  endDate: normalizePickerDate(val?.endDate),
                });
              }}
              inputClassName="rounded-xl border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-300 shadow-sm"
              displayFormat="MM/DD/YYYY"
              separator=" – "
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              containerClassName=""
              popupClassName={(defaultClass) => `${defaultClass} z-50`}
            />
          </div>
          <div className="relative" ref={filterButtonRef}>
            <Button
              variant="secondary"
              size="sm"
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterMenu((p) => !p);
              }}
            >
              <Filter className="h-4 w-4" />
            </Button>
            {showFilterMenu && (
              <div
                ref={filterMenuRef}
                className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg z-30 p-3 space-y-3"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={excludeCancel}
                    onChange={(e) => setExcludeCancel(e.target.checked)}
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

      {execLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading executive stats…</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
        <MetricCard label="Total Revenue" value={formatCurrency(execStats?.revenue)} helper="Across selected range" icon={<DollarSignIcon className="h-5 w-5" />} tone="default" />
        <MetricCard label="Total Sales" value={formatNumber(execStats?.purchases)} helper="Orders" icon={<TrendingUp className="h-5 w-5" />} tone="default" />
        <MetricCard label="Confirmed Sales" value={formatNumber(execStats?.confirmed ?? 0)} helper="Confirmed orders" icon={<CheckCircle2 className="h-5 w-5" />} tone="default" />
        <MetricCard label="Overall Spent" value={formatCurrency(execStats?.ad_spend)} helper="Ad spend (tax inclusive if selected)" icon={<Coins className="h-5 w-5" />} tone="default" />
        <MetricCard label="Overall AR %" value={formatPercent(execStats?.ar_pct)} helper="Spend / Revenue" icon={<PieChart className="h-5 w-5" />} tone="default" />
        <MetricCard
          label="CM (RTS 20%)"
          value={formatCurrency(execStats?.cm_rts_forecast)}
          helper="Forecasted contribution margin"
          icon={<Zap className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      {renderNameConvention()}
    </div>
  );

  const renderLeaderDashboard = () => (
    <div className="space-y-6">
      {error && (
        <div className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Good day, {displayName}{' '}
              {teamName ? <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 align-super">{teamName}</span> : null}
            </h1>
            <p className="text-sm text-slate-600">This is your team report based on the selected period.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Datepicker
              value={range}
              onChange={(val: any) => {
                setRange({
                  startDate: normalizePickerDate(val?.startDate),
                  endDate: normalizePickerDate(val?.endDate),
                });
              }}
              inputClassName="rounded-xl border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-300 shadow-sm"
              displayFormat="MM/DD/YYYY"
              separator=" – "
              toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              containerClassName=""
              popupClassName={(defaultClass) => `${defaultClass} z-50`}
            />
          </div>
          <div className="relative" ref={filterButtonRef}>
            <Button
              variant="secondary"
              size="sm"
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation();
                setShowFilterMenu((p) => !p);
              }}
            >
              <Filter className="h-4 w-4" />
            </Button>
            {showFilterMenu && (
              <div
                ref={filterMenuRef}
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-20 p-3 space-y-3"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={excludeCancel}
                    onChange={(e) => setExcludeCancel(e.target.checked)}
                  />
                  Exclude canceled
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={excludeRestocking}
                    onChange={(e) => setExcludeRestocking(e.target.checked)}
                  />
                  Exclude restocking
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {statsLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading your stats…</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <MetricCard label="My Ad Spend" value={formatCurrency(myStats?.ad_spend)} helper="Across selected range" icon={<Coins className="h-5 w-5 text-emerald-600" />} tone="default" />
        <MetricCard label="My AR" value={formatPercent(myStats?.ar)} helper="Spend / Revenue" icon={<PieChart className="h-5 w-5 text-blue-600" />} tone="default" />
        <MetricCard label="Team Ad Spend" value={formatCurrency(leaderStats?.team_ad_spend)} helper={teamName ? `${teamName} total spend` : 'Team total spend'} icon={<Users className="h-5 w-5 text-emerald-600" />} tone="default" />
        <MetricCard label="Team AR" value={formatPercent(leaderStats?.team_ar)} helper="Team Spend / Revenue" icon={<Boxes className="h-5 w-5 text-blue-600" />} tone="default" />
        <MetricCard label="Overall Team Ranking" value={leaderStats?.team_overall_ranking ?? '—'} helper="Coming soon" icon={<BarChart3 className="h-5 w-5 text-blue-600" />} tone="default" />
      </div>

      {renderNameConvention()}
    </div>
  );

  return (
    <div className="space-y-6">
      {canViewExecutives
        ? renderExecutiveDashboard()
        : canViewMarketingLeader
        ? renderLeaderDashboard()
        : canViewMarketingDashboard
        ? renderMarketingDashboard()
        : canViewSalesDashboard
        ? renderSalesDashboard()
        : renderDefaultDashboard()}
    </div>
  );
}
