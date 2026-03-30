export interface MetaIntegration {
  id: string;
  name: string;
  provider: string;
  status: string;
  enabled: boolean;
  config: Record<string, string | number | boolean | null | undefined>;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency: string | null;
  currencyMultiplier?: number | null;
  timezone: string | null;
  accountStatus: number | null;
  lastSyncAt: string | null;
}

export interface MetaAdInsight {
  accountId: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adId: string;
  adName: string;
  date: string;
  spend: number;
  clicks?: number;
  impressions?: number;
  leads?: number;
  status?: string;
  marketingAssociate?: string | null;
}

export interface InsightsDateRange {
  startDate: string | Date | null;
  endDate: string | Date | null;
}
