import type { BootstrapResponse } from '@/src/features/auth/types';
import type { StoxTabKey } from './types';

export const STOX_STOCK_READ_PERMISSIONS = [
  'wms.inventory.read',
  'wms.receiving.read',
] as const;

export const STOX_STOCK_PUTAWAY_PERMISSIONS = [
  'wms.inventory.transfer',
  'wms.receiving.edit',
  'wms.receiving.write',
] as const;

export const STOX_STOCK_MOVE_PERMISSIONS = [
  'wms.inventory.transfer',
  'wms.inventory.edit',
  'wms.inventory.write',
] as const;

export const STOX_PICK_EXECUTE_PERMISSIONS = [
  'wms.fulfillment.write',
  'wms.fulfillment.edit',
  'wms.fulfillment.override',
] as const;

export const STOX_PACK_EXECUTE_PERMISSIONS = [
  'wms.dispatch.write',
  'wms.dispatch.edit',
  'wms.dispatch.override',
] as const;
export const STOX_HISTORY_READ_ALL_PERMISSIONS = [
  'wms.history.read_all',
  'wms.fulfillment.override',
  'wms.dispatch.override',
] as const;

const STOX_PICK_SUPERVISOR_PERMISSIONS = [
  'wms.fulfillment.override',
] as const;

const STOX_PACK_SUPERVISOR_PERMISSIONS = [
  'wms.dispatch.override',
] as const;

const STOX_SCAN_READ_PERMISSIONS = [
  ...STOX_STOCK_READ_PERMISSIONS,
  'wms.fulfillment.read',
  ...STOX_PICK_EXECUTE_PERMISSIONS,
  ...STOX_PACK_EXECUTE_PERMISSIONS,
] as const;

export function isPlatformAdmin(bootstrap: BootstrapResponse) {
  return bootstrap.user.role === 'SUPER_ADMIN';
}

export function canEnterStoxWorkspace(bootstrap: BootstrapResponse) {
  return bootstrap.tenantReady || isPlatformAdmin(bootstrap);
}

export function hasAnyWmsPermission(
  bootstrap: BootstrapResponse,
  requiredPermissions: readonly string[],
) {
  if (isPlatformAdmin(bootstrap)) {
    return true;
  }

  return requiredPermissions.some((permission) => bootstrap.access.permissions.includes(permission));
}

export function canUseStoxTab(bootstrap: BootstrapResponse, tab: StoxTabKey) {
  if (tab === 'account' || tab === 'home') {
    return true;
  }

  if (tab === 'tasks') {
    return canUsePickWorkspace(bootstrap) || canUsePackWorkspace(bootstrap);
  }

  if (tab === 'history') {
    return canUseStoxHistoryWorkspace(bootstrap);
  }

  if (tab === 'scan') {
    return hasAnyWmsPermission(bootstrap, STOX_SCAN_READ_PERMISSIONS);
  }

  return false;
}

export function getAllowedStoxTabs(bootstrap: BootstrapResponse): StoxTabKey[] {
  const preferredOrder: StoxTabKey[] = ['home', 'tasks', 'scan', 'history', 'account'];

  return preferredOrder.filter((tab) => canUseStoxTab(bootstrap, tab));
}

export function getFallbackStoxTab(bootstrap: BootstrapResponse): StoxTabKey {
  const allowedTabs = getAllowedStoxTabs(bootstrap);

  return allowedTabs.find((tab) => tab !== 'account') ?? 'account';
}

export function canUseStoxStockPutaway(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_STOCK_PUTAWAY_PERMISSIONS);
}

export function canUseStoxStockMove(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_STOCK_MOVE_PERMISSIONS);
}

export function canUseStoxStockWorkspace(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_STOCK_READ_PERMISSIONS);
}

export function canUseStoxScanWorkspace(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_SCAN_READ_PERMISSIONS);
}

export function canUseStoxHistoryWorkspace(bootstrap: BootstrapResponse) {
  return canUsePickWorkspace(bootstrap)
    || canUsePackWorkspace(bootstrap)
    || hasAnyWmsPermission(bootstrap, STOX_HISTORY_READ_ALL_PERMISSIONS);
}

export function canViewAllStoxHistory(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_HISTORY_READ_ALL_PERMISSIONS);
}

export function canUsePickWorkspace(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_PICK_EXECUTE_PERMISSIONS)
    && (hasOperationalSupervisorAccess(bootstrap, 'pick') || bootstrap.operations?.taskAssignment === 'PICK');
}

export function canUsePackWorkspace(bootstrap: BootstrapResponse) {
  return hasAnyWmsPermission(bootstrap, STOX_PACK_EXECUTE_PERMISSIONS)
    && (hasOperationalSupervisorAccess(bootstrap, 'pack') || bootstrap.operations?.taskAssignment === 'PACK');
}

function hasOperationalSupervisorAccess(
  bootstrap: BootstrapResponse,
  area: 'pick' | 'pack',
) {
  if (isPlatformAdmin(bootstrap)) {
    return true;
  }

  const requiredPermissions = area === 'pick'
    ? STOX_PICK_SUPERVISOR_PERMISSIONS
    : STOX_PACK_SUPERVISOR_PERMISSIONS;

  return requiredPermissions.some((permission) => bootstrap.access.permissions.includes(permission));
}
