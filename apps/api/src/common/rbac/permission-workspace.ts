export const PERMISSION_WORKSPACES = ['erp', 'wms', 'all'] as const;

export type PermissionWorkspace = (typeof PERMISSION_WORKSPACES)[number];
export type AssignablePermissionWorkspace = Exclude<PermissionWorkspace, 'all'>;
export type StoredPermissionWorkspace = 'ERP' | 'WMS';

type RolePermissionLike = {
  permission?: {
    key?: string | null;
  } | null;
};

type RoleLike = {
  key?: string | null;
  workspace?: string | null;
  rolePermissions?: RolePermissionLike[] | null;
  permissions?: string[] | null;
};

export function isWmsPermissionKey(key: string) {
  return key.startsWith('wms.');
}

export function isWmsRoleKey(key?: string | null) {
  return typeof key === 'string' && key.startsWith('WMS_');
}

export function fromStoredPermissionWorkspace(
  workspace?: string | null,
): AssignablePermissionWorkspace | null {
  if (workspace === 'WMS' || workspace === 'wms') {
    return 'wms';
  }

  if (workspace === 'ERP' || workspace === 'erp') {
    return 'erp';
  }

  return null;
}

export function toStoredPermissionWorkspace(
  workspace: AssignablePermissionWorkspace,
): StoredPermissionWorkspace {
  return workspace === 'wms' ? 'WMS' : 'ERP';
}

export function getRolePermissionKeys(role: RoleLike) {
  if (Array.isArray(role.permissions)) {
    return role.permissions.filter((value): value is string => typeof value === 'string');
  }

  if (Array.isArray(role.rolePermissions)) {
    return role.rolePermissions
      .map((rolePermission) => rolePermission.permission?.key)
      .filter((value): value is string => typeof value === 'string');
  }

  return [];
}

export function filterPermissionKeysByWorkspace(
  permissionKeys: string[],
  workspace: PermissionWorkspace,
) {
  if (workspace === 'all') {
    return [...permissionKeys];
  }

  return permissionKeys.filter((key) =>
    workspace === 'wms' ? isWmsPermissionKey(key) : !isWmsPermissionKey(key),
  );
}

export function rolePrimaryWorkspace(role: RoleLike): AssignablePermissionWorkspace {
  const storedWorkspace = fromStoredPermissionWorkspace(role.workspace);
  if (storedWorkspace) {
    return storedWorkspace;
  }

  if (isWmsRoleKey(role.key)) {
    return 'wms';
  }

  const permissionKeys = getRolePermissionKeys(role);
  if (permissionKeys.length === 0) {
    return 'erp';
  }

  return permissionKeys.every(isWmsPermissionKey) ? 'wms' : 'erp';
}

export function roleBelongsToWorkspace(
  role: RoleLike,
  workspace: PermissionWorkspace,
) {
  if (workspace === 'all') {
    return true;
  }

  return rolePrimaryWorkspace(role) === workspace;
}

export function permissionKeysMatchWorkspace(
  permissionKeys: string[],
  workspace: AssignablePermissionWorkspace,
) {
  return permissionKeys.every((key) =>
    workspace === 'wms' ? isWmsPermissionKey(key) : !isWmsPermissionKey(key),
  );
}

export function normalizePermissionWorkspace(
  workspace?: string | null,
): PermissionWorkspace {
  if (workspace === 'wms' || workspace === 'all') {
    return workspace;
  }

  return 'erp';
}
