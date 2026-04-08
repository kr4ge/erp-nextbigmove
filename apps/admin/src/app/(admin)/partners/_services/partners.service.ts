import apiClient from '@/lib/api-client';
import type { BillingAddress, Partner, PartnerTypeOption } from '../_types/partners';

export type CreatePartnerPayload = {
  tenantName: string;
  tenantSlug: string;
  companyName?: string;
  billingAddress?: BillingAddress;
  partnerTypeId?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  planType: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  maxUsers: number;
  maxIntegrations: number;
  trialDays?: number;
};

export type UpdatePartnerPayload = {
  name: string;
  slug: string;
  companyName?: string;
  billingAddress?: BillingAddress;
  partnerTypeId?: string;
  planType: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  maxUsers: number;
  maxIntegrations: number;
};

export async function fetchPartnerTypes() {
  const response = await apiClient.get<PartnerTypeOption[]>('/wms/partner-types');
  return response.data;
}

export async function fetchPartners() {
  const response = await apiClient.get<Partner[]>('/tenants');
  return response.data;
}

export async function fetchPartnerById(partnerId: string) {
  const response = await apiClient.get<Partner>(`/tenants/${partnerId}`);
  return response.data;
}

export async function createPartner(payload: CreatePartnerPayload) {
  const response = await apiClient.post('/tenants', payload);
  return response.data;
}

export async function updatePartner(partnerId: string, payload: UpdatePartnerPayload) {
  const response = await apiClient.patch(`/tenants/${partnerId}`, payload);
  return response.data;
}

export async function updatePartnerStatus(partnerId: string, status: UpdatePartnerPayload['status']) {
  const response = await apiClient.patch(`/tenants/${partnerId}`, { status });
  return response.data;
}
