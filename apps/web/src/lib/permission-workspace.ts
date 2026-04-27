export function isWmsPermission(permission: string) {
  return permission.startsWith('wms.');
}

export function filterErpPermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions.filter(
    (permission): permission is string =>
      typeof permission === 'string' && !isWmsPermission(permission),
  );
}
