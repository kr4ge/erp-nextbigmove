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
      return 'pill pill-success';
    case 'TRIAL':
      return 'pill pill-info';
    case 'SUSPENDED':
      return 'pill pill-warning';
    case 'CANCELLED':
      return 'pill pill-destructive';
    default:
      return 'pill pill-white';
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
      return 'pill pill-info';
    case 'starter':
      return 'pill pill-success';
    case 'trial':
    default:
      return 'pill pill-destructive';
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
