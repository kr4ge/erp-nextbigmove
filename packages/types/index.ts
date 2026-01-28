// Shared types for ERP Analytics Platform

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELLED';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'SUSPENDED';

export type IntegrationStatus = 'PENDING' | 'ACTIVE' | 'ERROR' | 'DISABLED';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: TenantStatus;
  settings: Record<string, any>;
  metadata: Record<string, any>;
  features: string[];
  maxUsers: number;
  maxIntegrations: number;
  planType: string;
  billingEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Integration {
  id: string;
  name: string;
  provider: string;
  description?: string;
  tenantId: string;
  config: Record<string, any>;
  status: IntegrationStatus;
  enabled: boolean;
  lastSyncAt?: Date;
  syncStatus?: string;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  eventType: string;
  eventName: string;
  properties: Record<string, any>;
  source?: string;
  sourceId?: string;
  timestamp: Date;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Auth DTOs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

export interface AuthResponse {
  user: User;
  tenant: Tenant;
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
}
