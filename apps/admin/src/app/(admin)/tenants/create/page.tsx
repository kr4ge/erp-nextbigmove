'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Building2, Crown, ShieldCheck, Sparkles, User as UserIcon } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { WmsPageShell } from '../../_components/wms-page-shell';
import { WmsInlineNotice } from '../../_components/wms-inline-notice';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { WmsFormField } from '../../_components/wms-form-field';
import type { TenantPlan, TenantStatus } from '../_types/tenant';

const createTenantSchema = z.object({
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  tenantSlug: z
    .string()
    .min(2, 'Tenant slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(
      /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,
      'Password must contain uppercase, lowercase, and number/special character',
    ),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  planType: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  maxUsers: z.number().min(1).max(10000),
  maxIntegrations: z.number().min(1).max(100),
  trialDays: z.number().min(0).max(365).optional(),
});

type CreateTenantForm = z.infer<typeof createTenantSchema>;

type PlanPreset = {
  value: TenantPlan;
  label: string;
  tagline: string;
  icon: typeof Sparkles;
  accent: string;
  suggestedMaxUsers: number;
  suggestedMaxIntegrations: number;
  defaultStatus: TenantStatus;
};

const planPresets: PlanPreset[] = [
  {
    value: 'trial',
    label: 'Trial',
    tagline: 'Evaluate the platform for up to 14 days.',
    icon: Sparkles,
    accent: 'from-[#f8f7f0] to-[#f2ecdb]',
    suggestedMaxUsers: 10,
    suggestedMaxIntegrations: 5,
    defaultStatus: 'TRIAL',
  },
  {
    value: 'starter',
    label: 'Starter',
    tagline: 'Small teams getting started in production.',
    icon: ShieldCheck,
    accent: 'from-[#f0f5ea] to-[#e6eed5]',
    suggestedMaxUsers: 25,
    suggestedMaxIntegrations: 10,
    defaultStatus: 'ACTIVE',
  },
  {
    value: 'professional',
    label: 'Professional',
    tagline: 'Growing teams with multiple channels.',
    icon: Building2,
    accent: 'from-[#eaf1f5] to-[#d6e4ec]',
    suggestedMaxUsers: 100,
    suggestedMaxIntegrations: 25,
    defaultStatus: 'ACTIVE',
  },
  {
    value: 'enterprise',
    label: 'Enterprise',
    tagline: 'Large organizations with advanced limits.',
    icon: Crown,
    accent: 'from-[#efecf8] to-[#ddd4f0]',
    suggestedMaxUsers: 1000,
    suggestedMaxIntegrations: 50,
    defaultStatus: 'ACTIVE',
  },
];

const statusOptions: Array<{ value: TenantStatus; label: string }> = [
  { value: 'TRIAL', label: 'Trial' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function CreateTenantPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      planType: 'trial',
      status: 'TRIAL',
      maxUsers: 10,
      maxIntegrations: 5,
      trialDays: 14,
    },
  });

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === 'object'
      && error !== null
      && 'response' in error
      && typeof (error as { response?: unknown }).response === 'object'
      && (error as { response?: { data?: unknown } }).response?.data
      && typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
    ) {
      return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
    }

    return fallback;
  };

  const planType = watch('planType');

  const handleTenantNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setValue('tenantSlug', slug);
  };

  const handlePlanSelect = (preset: PlanPreset) => {
    setValue('planType', preset.value);
    setValue('status', preset.defaultStatus);
    setValue('maxUsers', preset.suggestedMaxUsers);
    setValue('maxIntegrations', preset.suggestedMaxIntegrations);
  };

  const onSubmit = async (data: CreateTenantForm) => {
    setError('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      await apiClient.post('/tenants', data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      router.push('/tenants');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to create tenant. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WmsPageShell
      breadcrumb="Tenants"
      title="Create tenant"
      description="Set up a new tenant organization together with its admin account and subscription limits."
      actions={
        <Link
          href="/tenants"
          className="wms-pill-control inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-4 font-semibold text-[#1d4b61] transition hover:border-[#c6d4dd]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to tenants
        </Link>
      }
    >
      {error ? <WmsInlineNotice tone="error">{error}</WmsInlineNotice> : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <WmsSectionCard
          eyebrow="Step 1"
          title="Organization"
          description="How the tenant will appear across the platform and in URLs."
        >
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <WmsFormField label="Organization name">
                <input
                  {...register('tenantName')}
                  type="text"
                  onChange={(event) => {
                    register('tenantName').onChange(event);
                    handleTenantNameChange(event.target.value);
                  }}
                  className="wms-input w-full rounded-[14px]"
                  placeholder="Acme Corporation"
                />
              </WmsFormField>
              {errors.tenantName ? (
                <p className="mt-1.5 text-[12px] text-rose-600">{errors.tenantName.message}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <WmsFormField
                label="Tenant slug"
                hint="Used in URLs. Lowercase letters, numbers, and hyphens only."
              >
                <input
                  {...register('tenantSlug')}
                  type="text"
                  className="wms-input w-full rounded-[14px] font-mono tracking-tight"
                  placeholder="acme-corp"
                />
              </WmsFormField>
              {errors.tenantSlug ? (
                <p className="mt-1.5 text-[12px] text-rose-600">{errors.tenantSlug.message}</p>
              ) : null}
            </div>
          </div>
        </WmsSectionCard>

        <WmsSectionCard
          eyebrow="Step 2"
          title="Admin account"
          description="First user created for the tenant. They will own the workspace and can invite others."
        >
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <WmsFormField label="First name">
                <input {...register('firstName')} type="text" className="wms-input w-full rounded-[14px]" placeholder="Juan" />
              </WmsFormField>
              {errors.firstName ? (
                <p className="mt-1.5 text-[12px] text-rose-600">{errors.firstName.message}</p>
              ) : null}
            </div>

            <div>
              <WmsFormField label="Last name">
                <input {...register('lastName')} type="text" className="wms-input w-full rounded-[14px]" placeholder="Dela Cruz" />
              </WmsFormField>
              {errors.lastName ? (
                <p className="mt-1.5 text-[12px] text-rose-600">{errors.lastName.message}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <WmsFormField label="Email address">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dce4ea] bg-[#fbfcfc] text-[#5e8196]">
                    <UserIcon className="h-4 w-4" />
                  </span>
                  <input
                    {...register('email')}
                    type="email"
                    className="wms-input w-full rounded-[14px]"
                    placeholder="admin@acme.com"
                  />
                </div>
              </WmsFormField>
              {errors.email ? (
                <p className="mt-1.5 text-[12px] text-rose-600">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <WmsFormField
                label="Password"
                hint="Must be at least 8 characters and include uppercase, lowercase, and a number or symbol."
              >
                <input
                  {...register('password')}
                  type="password"
                  className="wms-input w-full rounded-[14px]"
                  placeholder="••••••••"
                />
              </WmsFormField>
              {errors.password ? (
                <p className="mt-1.5 text-[12px] text-rose-600">{errors.password.message}</p>
              ) : null}
            </div>
          </div>
        </WmsSectionCard>

        <WmsSectionCard
          eyebrow="Step 3"
          title="Plan & limits"
          description="Pick a preset, then fine-tune the limits to match the contract."
        >
          <div className="space-y-5 p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {planPresets.map((preset) => {
                const Icon = preset.icon;
                const isActive = planType === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePlanSelect(preset)}
                    className={`group relative overflow-hidden rounded-[18px] border p-4 text-left transition ${
                      isActive
                        ? 'border-[#12384b] shadow-[0_18px_36px_-28px_rgba(18,56,75,0.45)]'
                        : 'border-[#dce4ea] hover:border-[#c6d4dd]'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br opacity-60 ${preset.accent}`} />
                    <div className="relative z-10 flex h-full flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#12384b] shadow-sm">
                          <Icon className="h-4 w-4" />
                        </span>
                        {isActive ? (
                          <span className="rounded-full bg-[#12384b] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#12384b]">{preset.label}</p>
                        <p className="mt-1 text-[12px] leading-5 text-[#5f7483]">{preset.tagline}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between text-[11px] font-semibold text-[#4d6677]">
                        <span>{preset.suggestedMaxUsers.toLocaleString()} users</span>
                        <span>{preset.suggestedMaxIntegrations} integrations</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <WmsFormField label="Status">
                <select {...register('status')} className="wms-select w-full rounded-[14px]">
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </WmsFormField>

              {planType === 'trial' ? (
                <WmsFormField label="Trial duration (days)" hint="0–365 days">
                  <input
                    {...register('trialDays', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    max={365}
                    className="wms-input w-full rounded-[14px]"
                  />
                </WmsFormField>
              ) : null}

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
          </div>
        </WmsSectionCard>

        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-[20px] border border-[#dce4ea] bg-white/90 px-4 py-3 shadow-[0_18px_36px_-28px_rgba(18,56,75,0.35)] backdrop-blur">
          <Link
            href="/tenants"
            className="wms-pill-control inline-flex items-center rounded-full border border-[#d7e0e7] bg-white px-4 font-semibold text-[#325368] transition hover:border-[#c6d4dd]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="wms-pill-control inline-flex items-center gap-2 rounded-full bg-[#12384b] px-4 font-semibold text-white shadow-[0_16px_36px_-24px_rgba(18,56,75,0.7)] transition hover:bg-[#0f3242] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isLoading ? 'Creating…' : 'Create tenant'}
          </button>
        </div>
      </form>
    </WmsPageShell>
  );
}
