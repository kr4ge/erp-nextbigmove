import type { BootstrapResponse } from '@/src/features/auth/types';
import type { StoxTabKey } from './types';

const TAB_PERMISSIONS: Record<Exclude<StoxTabKey, 'me'>, string[]> = {
  stock: ['wms.inventory.read', 'wms.receiving.read'],
  scan: ['wms.inventory.read', 'wms.receiving.read'],
  pick: ['wms.fulfillment.read', 'wms.fulfillment.pick', 'wms.picking.execute'],
  pack: ['wms.fulfillment.read', 'wms.fulfillment.pack', 'wms.packing.execute'],
};

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
  if (tab === 'me') {
    return true;
  }

  return hasAnyWmsPermission(bootstrap, TAB_PERMISSIONS[tab]);
}

export function getAllowedStoxTabs(bootstrap: BootstrapResponse): StoxTabKey[] {
  const preferredOrder: StoxTabKey[] = ['stock', 'scan', 'pick', 'pack', 'me'];

  return preferredOrder.filter((tab) => canUseStoxTab(bootstrap, tab));
}

export function getFallbackStoxTab(bootstrap: BootstrapResponse): StoxTabKey {
  const allowedTabs = getAllowedStoxTabs(bootstrap);

  return allowedTabs.find((tab) => tab !== 'me') ?? 'me';
}
