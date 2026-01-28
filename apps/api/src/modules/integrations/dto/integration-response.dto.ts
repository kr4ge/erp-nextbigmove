export class IntegrationResponseDto {
  id: string;
  name: string;
  provider: string;
  description?: string;
  status: string;
  enabled: boolean;
  tenantId?: string;
  teamId?: string | null;
  config: Record<string, any>;
  lastSyncAt?: Date;
  syncStatus?: string;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
  sharedTeamIds: string[];

  // Note: credentials field is NEVER included in responses
  constructor(integration: any) {
    this.id = integration.id;
    this.name = integration.name;
    this.provider = integration.provider;
    this.description = integration.description;
    this.status = integration.status;
    this.enabled = integration.enabled;
    this.tenantId = integration.tenantId;
    this.teamId = integration.teamId ?? null;
    this.config = integration.config || {};
    this.lastSyncAt = integration.lastSyncAt;
    this.syncStatus = integration.syncStatus;
    this.syncError = integration.syncError;
    this.createdAt = integration.createdAt;
    this.updatedAt = integration.updatedAt;
    this.sharedTeamIds = Array.isArray(integration.sharedTeams)
      ? integration.sharedTeams.map((st: any) => st.teamId)
      : [];
  }
}
