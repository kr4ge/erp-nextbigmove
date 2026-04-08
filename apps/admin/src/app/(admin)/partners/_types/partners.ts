export interface BillingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  province?: string | null;
  postalCode?: string | null;
  country: string;
}

export interface PartnerTypeOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface Partner {
  id: string;
  name: string;
  slug: string;
  companyName: string | null;
  billingAddress: BillingAddress | null;
  partnerTypeId: string | null;
  partnerType: PartnerTypeOption | null;
  status: string;
  planType: string;
  maxUsers: number;
  maxIntegrations: number;
  createdAt: string;
  updatedAt?: string;
  trialEndsAt: string | null;
  _count?: {
    users: number;
    integrations: number;
  };
}
