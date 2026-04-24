'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { WmsPageShell } from '../_components/wms-page-shell';
import { WmsInlineNotice } from '../_components/wms-inline-notice';
import { WmsWorkspaceCard } from '../_components/wms-workspace-card';
import { TenantsFilterBar } from './_components/tenants-filter-bar';
import { TenantsTable } from './_components/tenants-table';
import type { TenantPlan, TenantRecord, TenantStatus } from './_types/tenant';

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<TenantPlan | ''>('');

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await apiClient.get('/tenants', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setTenants(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load tenants');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
  }, [router]);

  const summary = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === 'ACTIVE').length;
    const trial = tenants.filter((t) => t.status === 'TRIAL').length;
    const suspended = tenants.filter((t) => t.status === 'SUSPENDED').length;
    return { total, active, trial, suspended };
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (statusFilter && tenant.status !== statusFilter) {
        return false;
      }
      if (planFilter && tenant.planType !== planFilter) {
        return false;
      }
      if (needle) {
        const haystack = `${tenant.name} ${tenant.slug}`.toLowerCase();
        if (!haystack.includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [tenants, statusFilter, planFilter, searchText]);

  return (
    <div className="space-y-5">
      <WmsPageShell
        title="Tenants"
        description="Manage all tenant organizations, their subscription plans, and access limits."
        actions={
          <Link
            href="/tenants/create"
            className="wms-pill-control inline-flex items-center gap-2 rounded-full bg-[#12384b] px-4 font-semibold text-white shadow-[0_16px_36px_-24px_rgba(18,56,75,0.7)] transition hover:bg-[#0f3242]"
          >
            <Plus className="h-3.5 w-3.5" />
            New tenant
          </Link>
        }
      >
        {error ? <WmsInlineNotice tone="error">{error}</WmsInlineNotice> : null}

        <div className="grid gap-3 xl:grid-cols-4">
          <InsightCard label="Total tenants" value={summary.total.toLocaleString()} />
          <InsightCard label="Active" value={summary.active.toLocaleString()} tone="success" />
          <InsightCard label="Trial" value={summary.trial.toLocaleString()} tone="info" />
          <InsightCard label="Suspended" value={summary.suspended.toLocaleString()} tone="warning" />
        </div>

        <WmsWorkspaceCard
          title="Directory"
          filters={
            <TenantsFilterBar
              searchText={searchText}
              onSearchTextChange={setSearchText}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              planFilter={planFilter}
              onPlanChange={setPlanFilter}
            />
          }
          footer={
            <div className="flex items-center justify-between gap-3 text-[12px] text-[#6f8290]">
              <span>
                Showing{' '}
                <span className="font-semibold text-[#12384b]">
                  {filteredTenants.length.toLocaleString()}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-[#12384b]">
                  {tenants.length.toLocaleString()}
                </span>{' '}
                tenant{tenants.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-full border border-[#dce4ea] bg-[#fbfcfc] px-3 py-1 text-[11px] font-semibold text-[#4d6677]">
                {isLoading ? 'Loading…' : 'Up to date'}
              </span>
            </div>
          }
        >
          <TenantsTable tenants={filteredTenants} isLoading={isLoading} />
        </WmsWorkspaceCard>
      </WmsPageShell>
    </div>
  );
}

type InsightTone = 'default' | 'success' | 'info' | 'warning';

function InsightCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: InsightTone;
}) {
  const accentMap: Record<InsightTone, string> = {
    default: 'bg-[#12384b]',
    success: 'bg-emerald-500',
    info: 'bg-[#4c87a5]',
    warning: 'bg-amber-500',
  };

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[#dce4ea] bg-white px-4 py-3">
      <div className={`absolute left-0 top-0 h-full w-1 ${accentMap[tone]}`} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
        {label}
      </p>
      <p className="mt-2 text-[1.4rem] font-semibold tracking-tight text-[#12384b]">{value}</p>
    </div>
  );
}
