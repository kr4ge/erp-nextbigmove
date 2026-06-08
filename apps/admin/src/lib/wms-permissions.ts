export const WMS_PURCHASING_EDIT_PERMISSIONS = [
  'wms.purchasing.edit',
] as const;

export const WMS_PURCHASING_POST_RECEIVING_PERMISSIONS = [
  'wms.purchasing.post_receiving',
  'wms.receiving.write',
] as const;

export const WMS_PRODUCTS_EDIT_PERMISSIONS = [
  'wms.products.edit',
] as const;

export const WMS_PRODUCTS_SYNC_PERMISSIONS = [
  'wms.products.sync',
  'wms.products.write',
] as const;

export const WMS_RECEIVING_CREATE_BATCH_PERMISSIONS = [
  'wms.receiving.write',
] as const;

export const WMS_RECEIVING_MANUAL_INPUT_PERMISSIONS = [
  'wms.receiving.manual_input',
  'wms.receiving.write',
] as const;

export const WMS_RECEIVING_PRINT_LABELS_PERMISSIONS = [
  'wms.receiving.print_labels',
  'wms.receiving.edit',
  'wms.receiving.write',
] as const;

export const WMS_TRANSFER_PUTAWAY_PERMISSIONS = [
  'wms.inventory.transfer',
  'wms.receiving.edit',
  'wms.receiving.write',
] as const;

export const WMS_INVENTORY_TRANSFER_PERMISSIONS = [
  'wms.inventory.transfer',
  'wms.inventory.edit',
  'wms.inventory.write',
] as const;

export const WMS_INVENTORY_ADJUST_PERMISSIONS = [
  'wms.inventory.adjust',
  'wms.inventory.edit',
  'wms.inventory.write',
] as const;

export const WMS_INVENTORY_PRINT_LABELS_PERMISSIONS = [
  'wms.inventory.print_labels',
  'wms.inventory.edit',
  'wms.inventory.write',
] as const;

export const WMS_USERS_READ_PERMISSIONS = [
  'wms.users.read',
] as const;

export const WMS_USERS_WRITE_PERMISSIONS = [
  'wms.users.write',
] as const;

export const WMS_ROLES_READ_PERMISSIONS = [
  'wms.roles.read',
] as const;

export const WMS_ROLES_WRITE_PERMISSIONS = [
  'wms.roles.write',
] as const;

export const WMS_SETTINGS_READ_PERMISSIONS = [
  ...WMS_USERS_READ_PERMISSIONS,
  ...WMS_ROLES_READ_PERMISSIONS,
] as const;

export const WMS_STOX_READ_PERMISSIONS = [
  'wms.stox.read',
] as const;

export const WMS_STOX_WRITE_PERMISSIONS = [
  'wms.stox.write',
] as const;

export const WMS_INTEGRATIONS_READ_PERMISSIONS = [
  'wms.integrations.read',
] as const;

export const WMS_INTEGRATIONS_WRITE_PERMISSIONS = [
  'wms.integrations.write',
] as const;

export const WMS_INTEGRATIONS_EDIT_PERMISSIONS = [
  'wms.integrations.edit',
] as const;

export const WMS_INTEGRATIONS_SYNC_PERMISSIONS = [
  'wms.integrations.sync',
] as const;

export const WMS_INTEGRATIONS_WEBHOOK_UPDATE_PERMISSIONS = [
  'wms.integrations.webhook.update',
] as const;

export const WMS_INTEGRATIONS_WEBHOOK_ROTATE_PERMISSIONS = [
  'wms.integrations.webhook.rotate',
] as const;

function normalizeAdminRole(role: string | null | undefined) {
  return typeof role === 'string'
    ? role.trim().toUpperCase()
    : null;
}

export function isPlatformAdminRole(role: string | null | undefined) {
  return normalizeAdminRole(role) === 'SUPER_ADMIN';
}

export function hasAnyAdminPermission(
  role: string | null | undefined,
  permissions: readonly string[],
  requiredPermissions: readonly string[],
) {
  if (isPlatformAdminRole(role)) {
    return true;
  }

  return requiredPermissions.some((permission) => permissions.includes(permission));
}

export function hasAdminPermission(
  role: string | null | undefined,
  permissions: readonly string[],
  requiredPermission: string,
) {
  return hasAnyAdminPermission(role, permissions, [requiredPermission]);
}
