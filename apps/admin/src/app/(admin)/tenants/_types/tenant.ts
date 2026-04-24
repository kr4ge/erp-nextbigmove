export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED';
export type TenantPlan = 'trial' | 'starter' | 'professional' | 'enterprise';

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  planType: TenantPlan;
  maxUsers: number;
  maxIntegrations: number;
  createdAt: string;
  updatedAt?: string;
  trialEndsAt: string | null;
  _count?: {
    users: number;
    integrations: number;
  };
};
