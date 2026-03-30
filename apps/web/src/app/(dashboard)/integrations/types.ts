export type IntegrationProvider = 'META_ADS' | 'PANCAKE_POS';

export type IntegrationStatus = 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

export interface Integration {
  id: string;
  name: string;
  provider: IntegrationProvider;
  description?: string;
  status: IntegrationStatus;
  enabled: boolean;
  config: Record<string, string | number | boolean | null | undefined>;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  teamId?: string | null;
  sharedTeamIds?: string[];
}
