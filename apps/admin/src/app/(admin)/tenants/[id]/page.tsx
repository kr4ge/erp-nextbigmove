'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Copy,
  Link2,
  PauseCircle,
  Plug,
  Users,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsFormField } from '../../_components/wms-form-field';
import type { TenantPlan, TenantRecord, TenantStatus } from '../_types/tenant';
import {
  formatTenantDateTime,
  formatTenantPlan,
  formatTenantStatus,
  getTenantPlanClassName,
  getTenantStatusClassName,
} from '../_utils/tenant-presenters';

const updateTenantSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2, 'Tenant slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  planType: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  maxUsers: z.number().min(1).max(10000),
  maxIntegrations: z.number().min(1).max(100),
});

type UpdateTenantForm = z.infer<typeof updateTenantSchema>;

const planOptions: Array<{ value: TenantPlan; label: string }> = [
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

const statusOptions: Array<{ value: TenantStatus; label: string }> = [
  { value: 'TRIAL', label: 'Trial' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function TenantDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateTenantForm>({
    resolver: zodResolver(updateTenantSchema),
  });

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await apiClient.get(`/tenants/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const tenantData: TenantRecord = response.data;
        setTenant(tenantData);

        setValue('name', tenantData.name);
        setValue('slug', tenantData.slug);
        setValue('planType', tenantData.planType);
        setValue('status', tenantData.status);
        setValue('maxUsers', tenantData.maxUsers);
        setValue('maxIntegrations', tenantData.maxIntegrations);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load tenant');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenant();
  }, [tenantId, router, setValue]);

  const refreshTenant = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await apiClient.get(`/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTenant(response.data);
    } catch {
      /* no-op */
    }
  };

  const onSubmit = async (data: UpdateTenantForm) => {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      const token = localStorage.getItem('access_token');
      await apiClient.patch(`/tenants/${tenantId}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccessMessage('Tenant updated successfully');
      await refreshTenant();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update tenant');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusAction = async (status: TenantStatus, confirmMessage?: string) => {
    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      await apiClient.patch(
        `/tenants/${tenantId}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSuccessMessage(`Tenant status set to ${formatTenantStatus(status)}`);
      setValue('status', status);
      await refreshTenant();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to set status to ${status}`);
    }
  };

  const handleCopySlug = async () => {
    if (!tenant?.slug) {
      return;
    }
    try {
      await navigator.clipboard.writeText(tenant.slug);
      setSlugCopied(true);
      setTimeout(() => setSlugCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const usageMetrics = useMemo(() => {
    if (!tenant) {
      return null;
    }
    const users = tenant._count?.users ?? 0;
    const integrations = tenant._count?.integrations ?? 0;
    return {
      users,
      integrations,
      usersPercent: tenant.maxUsers > 0 ? Math.min(100, Math.round((users / tenant.maxUsers) * 100)) : 0,
      integrationsPercent:
        tenant.maxIntegrations > 0
          ? Math.min(100, Math.round((integrations / tenant.maxIntegrations) * 100))
          : 0,
    };
  }, [tenant]);

  if (isLoading) {
    return (
      <WmsPageShell title="Tenant" breadcrumb="Tenants">
        <WmsInlineNotice tone="info">Loading tenant…</WmsInlineNotice>
      </WmsPageShell>
    );
  }

  if (!tenant) {
    return (
      <WmsPageShell title="Tenant" breadcrumb="Tenants">
        <WmsInlineNotice tone="error">Tenant not found</WmsInlineNotice>
      </WmsPageShell>
    );
  }

  return (
    <WmsPageShell
      breadcrumb="Tenants"
      title={tenant.name}
      description="Manage the tenant's identity, plan, and lifecycle status."
      actions={
        <>
          <Link
            href="/tenants"
            className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 font-semibold text-[#1d4b61] transition hover:border-[#c6d4dd]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTenantStatusClassName(tenant.status)}`}
          >
            {formatTenantStatus(tenant.status)}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTenantPlanClassName(tenant.planType)}`}
          >
            {formatTenantPlan(tenant.planType)}
          </span>
        </>
      }
    >
      {error ? <WmsInlineNotice tone="error">{error}</WmsInlineNotice> : null}
      {successMessage ? <WmsInlineNotice tone="success">{successMessage}</WmsInlineNotice> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <WmsSectionCard
            eyebrow="Identity"
            title="Organization"
            description="Control how the tenant appears in the platform."
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <WmsFormField label="Organization name">
                  <input {...register('name')} type="text" className="wms-input w-full rounded-[14px]" />
                </WmsFormField>
                {errors.name ? (
                  <p className="mt-1.5 text-[12px] text-rose-600">{errors.name.message}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <WmsFormField label="Tenant slug" hint="Appears in URLs. Lowercase letters, numbers, and hyphens only.">
                  <div className="flex items-center gap-2">
                    <input
                      {...register('slug')}
                      type="text"
                      className="wms-input w-full rounded-[14px] font-mono tracking-tight"
                    />
                    <button
                      type="button"
                      onClick={handleCopySlug}
                      className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-3.5 font-semibold text-[#4d6677] transition hover:border-[#c6d4dd] hover:text-[#12384b]"
                    >
                      {slugCopied ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </WmsFormField>
                {errors.slug ? (
                  <p className="mt-1.5 text-[12px] text-rose-600">{errors.slug.message}</p>
                ) : null}
              </div>
            </div>
          </WmsSectionCard>

          <WmsSectionCard
            eyebrow="Plan"
            title="Subscription & limits"
            description="The plan, status, and usage caps applied to this tenant."
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <WmsFormField label="Plan type">
                <select {...register('planType')} className="wms-select w-full rounded-[14px]">
                  {planOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </WmsFormField>

              <WmsFormField label="Status">
                <select {...register('status')} className="wms-select w-full rounded-[14px]">
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </WmsFormField>

              <WmsFormField label="Max users">
                <input
                  {...register('maxUsers', { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={10000}
                  className="wms-input w-full rounded-[14px]"
                />
              </WmsFormField>

              <WmsFormField label="Max integrations">
                <input
                  {...register('maxIntegrations', { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={100}
                  className="wms-input w-full rounded-[14px]"
                />
              </WmsFormField>
            </div>
          </WmsSectionCard>

          <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-[20px] border border-[#dce4ea] bg-white/90 px-4 py-3 shadow-[0_18px_36px_-28px_rgba(18,56,75,0.35)] backdrop-blur">
            <span className="mr-auto text-[12px] text-[#6f8290]">
              {isDirty ? 'You have unsaved changes' : 'All changes saved'}
            </span>
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="wms-pill-control inline-flex items-center gap-2 rounded-full bg-[#12384b] px-4 font-semibold text-white shadow-[0_16px_36px_-24px_rgba(18,56,75,0.7)] transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <aside className="space-y-5">
          <WmsSectionCard eyebrow="Usage" title="Limits at a glance">
            <div className="space-y-4 p-5">
              <UsageRow
                icon={<Users className="h-4 w-4" />}
                label="Users"
                current={usageMetrics?.users ?? 0}
                max={tenant.maxUsers}
                percent={usageMetrics?.usersPercent ?? 0}
              />
              <UsageRow
                icon={<Plug className="h-4 w-4" />}
                label="Integrations"
                current={usageMetrics?.integrations ?? 0}
                max={tenant.maxIntegrations}
                percent={usageMetrics?.integrationsPercent ?? 0}
              />
            </div>
          </WmsSectionCard>

          <WmsSectionCard eyebrow="Timeline" title="Key dates">
            <div className="space-y-2.5 p-5">
              <TimelineRow
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                label="Created"
                value={formatTenantDateTime(tenant.createdAt)}
              />
              {tenant.updatedAt ? (
                <TimelineRow
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                  label="Last updated"
                  value={formatTenantDateTime(tenant.updatedAt)}
                />
              ) : null}
              {tenant.trialEndsAt ? (
                <TimelineRow
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                  label="Trial ends"
                  value={formatTenantDateTime(tenant.trialEndsAt)}
                />
              ) : null}
            </div>
          </WmsSectionCard>

          <WmsSectionCard eyebrow="Actions" title="Quick actions">
            <div className="space-y-2 p-5">
              {tenant.status !== 'ACTIVE' ? (
                <QuickActionButton
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="Activate tenant"
                  onClick={() => handleStatusAction('ACTIVE')}
                  tone="primary"
                />
              ) : null}
              {tenant.status === 'ACTIVE' ? (
                <QuickActionButton
                  icon={<PauseCircle className="h-3.5 w-3.5" />}
                  label="Suspend tenant"
                  onClick={() =>
                    handleStatusAction('SUSPENDED', 'Are you sure you want to suspend this tenant?')
                  }
                  tone="warning"
                />
              ) : null}
              <QuickActionButton
                icon={<Users className="h-3.5 w-3.5" />}
                label="View users"
                href={`/tenants/${tenant.id}/users`}
              />
              <QuickActionButton
                icon={<Link2 className="h-3.5 w-3.5" />}
                label="View integrations"
                href={`/tenants/${tenant.id}/integrations`}
              />
            </div>
          </WmsSectionCard>

          <WmsSectionCard
            eyebrow="Danger zone"
            title="Cancel tenant"
            description="Cancellation disables the tenant. Data is retained for compliance."
            className="border-rose-200/80"
          >
            <div className="p-5">
              <button
                type="button"
                onClick={() =>
                  handleStatusAction(
                    'CANCELLED',
                    'Cancel this tenant? The organization will lose access immediately.',
                  )
                }
                className="wms-pill-control inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Cancel tenant
              </button>
            </div>
          </WmsSectionCard>
        </aside>
      </div>
    </WmsPageShell>
  );
}

function UsageRow({
  icon,
  label,
  current,
  max,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  max: number;
  percent: number;
}) {
  const barColor =
    percent >= 90 ? 'bg-rose-400' : percent >= 70 ? 'bg-amber-400' : 'bg-[#12384b]';

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#12384b] text-white">
            {icon}
          </span>
          {label}
        </div>
        <span className="text-[12px] font-semibold tabular-nums text-[#12384b]">
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#eef2f5]">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TimelineRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[#dce4ea] bg-[#fbfcfc] px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#12384b] text-white">
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
          {label}
        </span>
      </div>
      <span className="truncate text-right text-[12.5px] font-semibold text-[#12384b]" title={value}>
        {value}
      </span>
    </div>
  );
}

type QuickActionTone = 'neutral' | 'primary' | 'warning';

function QuickActionButton({
  icon,
  label,
  href,
  onClick,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: QuickActionTone;
}) {
  const toneClasses: Record<QuickActionTone, string> = {
    neutral:
      'border border-[#d7e0e7] bg-white text-[#12384b] hover:border-[#c6d4dd] hover:bg-[#f8fafb]',
    primary:
      'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning:
      'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  };

  const base =
    'wms-pill-control inline-flex w-full items-center justify-between gap-2 rounded-full px-4 font-semibold transition';

  if (href) {
    return (
      <Link href={href} className={`${base} ${toneClasses[tone]}`}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${base} ${toneClasses[tone]}`}>
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );
}
