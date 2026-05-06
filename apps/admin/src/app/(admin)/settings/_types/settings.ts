export type WmsSettingsTenant = {
  id: string;
  name: string;
  slug: string;
};

export type WmsSettingsScope = {
  isPlatformAdmin: boolean;
  tenantId: string | null;
};

export type WmsSettingsProfile = {
  id?: string;
  userId?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  role?: string;
};

export type UpdateWmsSettingsProfileInput = {
  firstName?: string;
  lastName?: string;
  avatar?: string | null;
  employeeId?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

export type WmsSettingsPermission = {
  id?: string;
  key: string;
  description: string | null;
};

export type WmsSettingsUserRole = {
  assignmentId: string;
  tenant: WmsSettingsTenant | null;
  role: {
    id: string;
    key: string;
    name: string;
    scope: string;
    workspace: string;
    permissionCount: number;
  };
};

export type WmsSettingsUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  employeeId: string | null;
  platformRole: string;
  status: string;
  tenant: WmsSettingsTenant | null;
  lastLoginAt: string | null;
  createdAt: string;
  wmsRoles: WmsSettingsUserRole[];
  directPermissions: Array<{
    key: string;
    description: string | null;
    allow: boolean;
    tenantId: string | null;
  }>;
};

export type WmsSettingsUserOptions = {
  scope: WmsSettingsScope;
  roles: Array<{
    id: string;
    tenantId: string | null;
    key: string;
    name: string;
    scope: string;
    isSystem: boolean;
  }>;
  statuses: string[];
};

export type CreateWmsSettingsUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId?: string | null;
  roleId: string;
  status?: string;
};

export type UpdateWmsSettingsUserInput = {
  firstName?: string;
  lastName?: string;
  employeeId?: string | null;
  password?: string;
  roleId?: string;
  status?: string;
};

export type WmsSettingsRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: string;
  workspace: string;
  isSystem: boolean;
  tenant: WmsSettingsTenant | null;
  permissionCount: number;
  assignedUserCount: number;
  permissions: WmsSettingsPermission[];
};

export type WmsSettingsRoleOptions = {
  scope: WmsSettingsScope;
  permissions: WmsSettingsPermission[];
};

export type CreateWmsSettingsRoleInput = {
  name: string;
  key: string;
  description?: string | null;
  permissionKeys: string[];
};

export type UpdateWmsSettingsRoleInput = {
  name?: string;
  key?: string;
  description?: string | null;
  permissionKeys?: string[];
};

export type WmsSettingsUsersResponse = {
  scope: WmsSettingsScope;
  users: WmsSettingsUser[];
};

export type WmsSettingsRolesResponse = {
  scope: WmsSettingsScope;
  roles: WmsSettingsRole[];
  permissions: WmsSettingsPermission[];
};
