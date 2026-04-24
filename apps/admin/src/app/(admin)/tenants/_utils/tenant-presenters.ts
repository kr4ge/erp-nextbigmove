import type { TenantPlan, TenantStatus } from '../_types/tenant';

export function formatTenantStatus(status: TenantStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'TRIAL':
      return 'Trial';
    case 'SUSPENDED':
      return 'Suspended';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

export function getTenantStatusClassName(status: TenantStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'TRIAL':
      return 'border border-[#c7dbe7] bg-[#eff5f9] text-[#1d4b61]';
    case 'SUSPENDED':
      return 'border border-amber-200 bg-amber-50 text-amber-700';
    case 'CANCELLED':
      return 'border border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677]';
  }
}

export function formatTenantPlan(plan: TenantPlan) {
  switch (plan) {
    case 'trial':
      return 'Trial';
    case 'starter':
      return 'Starter';
    case 'professional':
      return 'Professional';
    case 'enterprise':
      return 'Enterprise';
    default:
      return plan;
  }
}

export function getTenantPlanClassName(plan: TenantPlan) {
  switch (plan) {
    case 'enterprise':
      return 'border border-[#d9d2f1] bg-[#f3f0fb] text-[#5b4caa]';
    case 'professional':
      return 'border border-[#c7dbe7] bg-[#eff5f9] text-[#1d4b61]';
    case 'starter':
      return 'border border-[#dbe7cf] bg-[#f3f7ec] text-[#4f6b33]';
    case 'trial':
    default:
      return 'border border-[#dce4ea] bg-[#fbfcfc] text-[#4d6677]';
  }
}

export function formatTenantDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTenantDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
