'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { Filter, Gauge, Share2 } from 'lucide-react';
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

const metricDefinitions: { key: keyof OverviewResponse['kpis']; label: string; format: 'currency' | 'percent' | 'number' }[] = [
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

function formatValue(val: number, format: 'currency' | 'percent' | 'number') {
  if (!Number.isFinite(val)) return '—';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(val);
  }
  if (format === 'percent') {
    return `${val.toFixed(2)}%`;
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
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

export default function MarketingAnalyticsPage() {
  const today = useMemo(() => formatDateInTimezone(new Date()), []);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [selectedAssociates, setSelectedAssociates] = useState<string[]>([]);
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
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showAssociatePicker, setShowAssociatePicker] = useState(false);
  const [range, setRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: parseYmdToLocalDate(startDate),
    endDate: parseYmdToLocalDate(endDate),
  });
  const [associateSearch, setAssociateSearch] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [excludeCanceled, setExcludeCanceled] = useState(true);
  const [excludeRestocking, setExcludeRestocking] = useState(true);
  const associatePickerRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const filterMenuContentRef = useRef<HTMLDivElement | null>(null);
  const normalizedOptions = () => associatesOptions.map((a) => a.toLowerCase());
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTeams, setShareTeams] = useState<{ id: string; name: string }[]>([]);
  const [shareSelected, setShareSelected] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  const fetchDataRef = useRef<typeof fetchData>();

  const fetchData = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError(null);
    try {
      const normalizedOpts = normalizedOptions();
      const effectiveSel = selectedAssociates.length === 0 ? normalizedOpts : selectedAssociates;
      const sendAll = effectiveSel.length === normalizedOpts.length;
      const params = new URLSearchParams();
      params.set('start_date', startDate);
      params.set('end_date', endDate);
      params.set('tables', tableSelection);
      if (!sendAll && effectiveSel.length > 0) {
        effectiveSel.forEach((a) => params.append('associate', a));
      }
      params.set('exclude_cancel', String(excludeCanceled));
      params.set('exclude_restocking', String(excludeRestocking));
      const res = await apiClient.get<OverviewResponse>(`/analytics/marketing/overview?${params.toString()}`);
      setData(res.data);
      const options = res.data.filters.associates || [];
      const normalized = options.map((a) => a.toLowerCase());
      setAssociatesOptions(options);
      setAssociatesDisplayMap(res.data.filters.associatesDisplayMap || {});
      const boundedSel = effectiveSel.filter((p) => normalized.includes(p));
      const finalSel = boundedSel.length === 0 ? normalized : boundedSel;
      setSelectedAssociates(finalSel);
      setLastUpdated(res.data.lastUpdatedAt);
      setTopAssociates(res.data.topAssociates || []);
      setTopCampaigns(res.data.topCampaigns || []);
      setTopAssocPage(1);
      setTopCampaignPage(1);
      setTopCreatives(res.data.topCreatives || []);
      setTopCreativePage(1);
      // Sync selected range if API adjusted it
      setStartDate(res.data.selected.start_date);
      setEndDate(res.data.selected.end_date);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load marketing overview');
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const onTeamScope = () => fetchData();
    if (typeof window !== 'undefined') {
      window.addEventListener('teamScopeChanged', onTeamScope as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('teamScopeChanged', onTeamScope as EventListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedAssociates.join('|'), excludeCanceled, excludeRestocking, tableSelection]);

  // Lightweight auto-refresh every 60s when tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData({ silent: true });
      }
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedAssociates.join('|'), excludeCanceled, excludeRestocking, tableSelection]);

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
        // ignore
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
      const resShare = await apiClient.get('/analytics/shares', { params: { scope: 'marketing' } });
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
      await apiClient.post('/analytics/shares', { scope: 'marketing', sharedTeamIds: shareSelected });
      setShareOpen(false);
    } finally {
      setShareSaving(false);
    }
  };

  // Realtime: listen for marketing updates via websocket and refetch on change
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
        // ignore parse errors
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
      if (showAssociatePicker && associatePickerRef.current && target && !associatePickerRef.current.contains(target)) {
        setShowAssociatePicker(false);
      }
      const inFilter =
        filterMenuRef.current?.contains(target) || filterMenuContentRef.current?.contains(target);
      if (showFilterMenu && target && !inFilter) {
        setShowFilterMenu(false);
      }
      if (showTableMenu && target && !e.composedPath().some((n) => (n as HTMLElement).dataset?.tableMenu === 'true')) {
        setShowTableMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssociatePicker, showFilterMenu]);

  const handleResetDates = () => {
    setStartDate(today);
    setEndDate(today);
    setRange({ startDate: parseYmdToLocalDate(today), endDate: parseYmdToLocalDate(today) });
  };

  const handleResetAssociates = () => {
    setSelectedAssociates([]);
    setShowAssociatePicker(false);
  };

  const associateDisplay = (val: string) => associatesDisplayMap[val.toLowerCase()] || val;
  const selectedAssociateLabel =
    selectedAssociates.length === associatesOptions.length
      ? 'All associates'
      : `${selectedAssociates.length} selected`;
  const isChecked = (norm: string) => selectedAssociates.includes(norm);

  const metrics = data ? metricDefinitions.map((def) => {
    const current = data.kpis[def.key] ?? 0;
    const previous = data.prevKpis[def.key] ?? 0;
    const delta = formatDelta(current, previous);
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

  const formatShortCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(val);

  const pageSize = 10;
  const totalTopAssociates = topAssociates?.length || 0;
  const totalTopPages = Math.max(1, Math.ceil(totalTopAssociates / pageSize));
  const pagedTopAssociates = (topAssociates || []).slice((topAssocPage - 1) * pageSize, topAssocPage * pageSize);
  const topAssocStart = totalTopAssociates === 0 ? 0 : (topAssocPage - 1) * pageSize + 1;
  const topAssocEnd = Math.min(topAssocPage * pageSize, totalTopAssociates);
  const topAssocCanPrev = topAssocPage > 1;
  const topAssocCanNext = topAssocPage < totalTopPages;

  const tableOptions: Array<{ key: 'associates' | 'campaigns' | 'creatives'; label: string }> = [
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing Analytics"
        description="Monitor revenue, spend, and efficiency by marketing associate."
      />

      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
              <Gauge className="h-5 w-5" />
            </span>
            <p className="text-lg font-semibold text-slate-900">Monitoring</p>
          </div>
          <p className="text-sm text-slate-400">
            Last updated: <span className="font-medium text-slate-600">{lastUpdatedLabel}</span>
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-start gap-x-8 mt-5">
          {/* Marketing Associate */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Marketing Associate</p>
            <div className="relative" ref={associatePickerRef}>
              <button
                type="button"
                onClick={() => setShowAssociatePicker((p) => !p)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none"
              >
                <span className="text-slate-900">{selectedAssociateLabel}</span>
                <span className="text-slate-400 text-xs">(click to choose)</span>
              </button>
              {showAssociatePicker && (
                <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 border-b border-slate-100">
                    <span>Select associates</span>
                    <button
                      type="button"
                      onClick={handleResetAssociates}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={associateSearch}
                      onChange={(e) => setAssociateSearch(e.target.value)}
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
                            associatesOptions.length > 0 &&
                            selectedAssociates.length === associatesOptions.length
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedAssociates(checked ? normalizedOptions() : []);
                            setShowAssociatePicker(true);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>All</span>
                      </label>
                    </div>
                    {associatesOptions
                      .filter((assoc) =>
                        associateSearch.trim()
                          ? associateDisplay(assoc).toLowerCase().includes(associateSearch.toLowerCase())
                          : true,
                      )
                      .map((assoc) => {
                        const norm = assoc.toLowerCase();
                        const checked = isChecked(norm);
                        return (
                          <div
                            key={assoc}
                            className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedAssociates((prev) =>
                                    prev.includes(norm)
                                      ? prev.filter((v) => v !== norm)
                                      : [...prev, norm],
                                  );
                                  setShowAssociatePicker(true);
                                }}
                                className="rounded border-slate-300"
                              />
                              <span>{titleCase(associateDisplay(assoc))}</span>
                            </label>
                            <button
                              type="button"
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                              onClick={() => {
                                setSelectedAssociates([norm]);
                                setShowAssociatePicker(true);
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

          {/* Date Range */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Date range</p>
            <div className="flex items-center gap-2">
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
                      if (d instanceof Date) return formatDateInTimezone(d);
                      return today;
                    };
                    setStartDate(formatDate(nextStart));
                    setEndDate(formatDate(nextEnd));
                  }}
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 mt-5">
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

      {/* Top Tables */}
      <Card className="px-2 sm:px-2 py-2 border-slate-200 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="relative" data-table-menu="true">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-lg font-semibold text-slate-900"
              onClick={() => setShowTableMenu((p) => !p)}
            >
              {tableOptions.find((t) => t.key === tableSelection)?.label || 'Top Associates'}
              <span className="text-slate-500">▾</span>
            </button>
            {showTableMenu && (
              <div className="absolute left-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-20">
              {tableOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`block w-full text-left px-3 py-2 text-sm ${tableSelection === opt.key ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}`}
                  onClick={() => {
                    setTableSelection(opt.key);
                    setTopAssocPage(1);
                    setTopCampaignPage(1);
                    setTopCreativePage(1);
                    setShowTableMenu(false);
                  }}
                >
                  {opt.label}
                </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {tableSelection === 'associates' && (
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">#</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Marketing Associate</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Revenue (₱)</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">CPC (₱)</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad Spend (₱)</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">AR (%)</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Conversion (%)</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ads Running</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ads Created</th>
                  <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ads Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx}>
                        {Array.from({ length: 10 }).map((__, cIdx) => (
                          <td key={cIdx} className="px-3 sm:px-4 lg:px-6 py-3">
                            <div className="h-3 w-16 bg-slate-200 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : pagedTopAssociates.map((row, idx) => (
                      <tr key={`${row.associate}-${idx}`} className="hover:bg-slate-50">
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{(topAssocPage - 1) * pageSize + idx + 1}.</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                          {titleCase(row.associateDisplay || row.associate)}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.revenue)}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.cpc)}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.ad_spend)}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{(row.ar_pct ?? 0).toFixed(1)}%</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{(row.conversion_pct ?? 0).toFixed(1)}%</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap text-center">{row.ads_running ?? 0}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap text-center">{row.ads_created ?? 0}</td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap text-center">{row.ads_active ?? 0}</td>
                      </tr>
                    ))}
                {!isLoading && (!topAssociates || topAssociates.length === 0) && (
                  <tr>
                    <td className="px-3 sm:px-4 lg:px-6 py-4 text-center text-slate-500" colSpan={10}>
                      No associates found for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <p className="text-sm text-slate-600">
              Showing {topAssocStart}-{topAssocEnd} of {totalTopAssociates}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setTopAssocPage((p) => Math.max(1, p - 1))}
                disabled={!topAssocCanPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setTopAssocPage((p) => (topAssocCanNext ? p + 1 : p))}
                disabled={!topAssocCanNext || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        )}
        {tableSelection === 'campaigns' && (
          <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">#</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Campaign</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Revenue (₱)</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">CPC (₱)</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad Spend (₱)</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">AR (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx}>
                          {Array.from({ length: 6 }).map((__, cIdx) => (
                            <td key={cIdx} className="px-3 sm:px-4 lg:px-6 py-3">
                              <div className="h-3 w-16 bg-slate-200 animate-pulse rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : pagedTopCampaigns.map((row, idx) => (
                        <tr key={`${row.campaign}-${idx}`} className="hover:bg-slate-50">
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {(topCampaignPage - 1) * pageSize + idx + 1}.
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900 font-medium">
                            <div className="min-w-[150px] max-w-[260px]">
                              <div className="truncate" title={row.campaign}>{row.campaign || '—'}</div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.revenue)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.cpc)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.ad_spend)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{(row.ar_pct ?? 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                {!isLoading && (!topCampaigns || topCampaigns.length === 0) && (
                  <tr>
                    <td className="px-3 sm:px-4 lg:px-6 py-4 text-center text-slate-500" colSpan={6}>
                      No campaigns found for this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <p className="text-sm text-slate-600">
              Showing {topCampaignStart}-{topCampaignEnd} of {totalTopCampaigns}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setTopCampaignPage((p) => Math.max(1, p - 1))}
                disabled={!topCampaignCanPrev || isLoading}
              >
                Previous
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => setTopCampaignPage((p) => (topCampaignCanNext ? p + 1 : p))}
                disabled={!topCampaignCanNext || isLoading}
              >
                Next
              </button>
            </div>
            </div>
          </div>
        )}
        {tableSelection === 'creatives' && (
          <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">#</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Marketing Associate</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Revenue (₱)</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">CPC (₱)</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ad Spend (₱)</th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">AR (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx}>
                          {Array.from({ length: 7 }).map((__, cIdx) => (
                            <td key={cIdx} className="px-3 sm:px-4 lg:px-6 py-3">
                              <div className="h-3 w-16 bg-slate-200 animate-pulse rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : pagedTopCreatives.map((row, idx) => (
                        <tr key={`${row.associate}-${row.ad_name}-${idx}`} className="hover:bg-slate-50">
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {(topCreativePage - 1) * pageSize + idx + 1}.
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                            {titleCase(row.associateDisplay || row.associate)}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-900">
                            <div className="min-w-[150px] max-w-[260px]">
                              <div className="truncate" title={row.ad_name || '—'}>{row.ad_name || '—'}</div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.revenue)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.cpc)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{formatShortCurrency(row.ad_spend)}</td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 text-sm text-slate-700 whitespace-nowrap">{(row.ar_pct ?? 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                  {!isLoading && (!topCreatives || topCreatives.length === 0) && (
                    <tr>
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-center text-slate-500" colSpan={7}>
                        No creatives found for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0">
              <p className="text-sm text-slate-600">
                Showing {topCreativeStart}-{topCreativeEnd} of {totalTopCreatives}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setTopCreativePage((p) => Math.max(1, p - 1))}
                  disabled={!topCreativeCanPrev || isLoading}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setTopCreativePage((p) => (topCreativeCanNext ? p + 1 : p))}
                  disabled={!topCreativeCanNext || isLoading}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Marketing Analytics</DialogTitle>
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
