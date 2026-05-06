export type LoginUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  role?: string | null;
};

export type LoginTenant = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
} | null;

export type AuthResponse = {
  user: LoginUser;
  tenant: LoginTenant;
  accessToken: string;
  refreshToken: string;
  sessionId?: string | null;
};

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  sessionId: string | null;
  user: LoginUser;
  tenant: LoginTenant;
};

export type TenantOption = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
};

export type BootstrapResponse = {
  tenantReady: boolean;
  app?: {
    key: string;
    phase: number;
    mode: string;
  };
  session?: {
    sessionId: string | null;
  };
  user: LoginUser;
  tenant: LoginTenant;
  access: {
    permissions: string[];
    roles: Array<{
      id: string;
      key: string;
      name: string;
      scope: string;
      workspace: string;
      teamId: string | null;
    }>;
  };
  context: {
    tenantOptions?: TenantOption[];
    defaultTeamId: string | null;
    defaultStoreId: string | null;
    defaultWarehouseId: string | null;
    teams: Array<{
      id: string;
      name: string;
      code: string | null;
      isDefault: boolean;
      role: {
        id: string;
        key: string;
        name: string;
        workspace: string;
      } | null;
    }>;
    stores: Array<{
      id: string;
      name: string;
      shopId: string;
      shopName: string;
      teamId: string | null;
    }>;
    warehouses: Array<{
      id: string;
      code: string;
      name: string;
      status: string;
    }>;
  };
  readiness?: {
    teams: number;
    stores: number;
    warehouses: number;
  };
};

export type DeviceIdentity = {
  id: string;
  name: string;
};
