export interface MetaIntegration {
  id: string;
  name: string;
  provider: string;
  status: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  teamId?: string | null;
}
