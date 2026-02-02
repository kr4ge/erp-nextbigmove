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

  const canViewMarketingDashboard = useMemo(() => {
    return perms.includes('dashboard.marketing');
  }, [perms]);

  const canViewMarketingLeader = useMemo(() => perms.includes('dashboard.marketing_leader'), [perms]);
  const canViewExecutives = useMemo(() => perms.includes('dashboard.executives'), [perms]);

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
        : renderDefaultDashboard()}
    </div>
  );
}
