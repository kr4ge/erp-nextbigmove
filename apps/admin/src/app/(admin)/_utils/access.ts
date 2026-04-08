"use client";

export const WMS_SETTINGS_PROFILE_PERMISSION = "wms.settings.profile.read";
export const WMS_SETTINGS_USERS_PERMISSION = "wms.settings.users.read";
export const WMS_SETTINGS_ROLES_PERMISSION = "wms.settings.roles.read";

const WMS_MODULE_ROUTE_PERMISSIONS = [
  { href: "/partners", permissions: ["wms.partners.read"] },
  { href: "/forecast", permissions: ["wms.requests.read"] },
  { href: "/requests", permissions: ["wms.requests.read", "wms.billing.read"] },
  { href: "/products", permissions: ["wms.inventory.read"] },
  { href: "/inventory/warehouses", permissions: ["wms.warehouses.read"] },
  { href: "/inventory/stock", permissions: ["wms.inventory.read"] },
  { href: "/inventory/balances", permissions: ["wms.inventory.read"] },
  { href: "/inventory/units", permissions: ["wms.inventory.read"] },
  { href: "/inventory/transfers", permissions: ["wms.inventory.read"] },
  { href: "/inventory/lots", permissions: ["wms.inventory.read"] },
  { href: "/inventory/ledger", permissions: ["wms.inventory.read"] },
  { href: "/inventory/adjustments", permissions: ["wms.inventory.read"] },
  { href: "/inventory/catalog", permissions: ["wms.inventory.read"] },
  { href: "/inventory/products", permissions: ["wms.inventory.read"] },
  { href: "/inventory", permissions: ["wms.inventory.read"] },
  { href: "/purchasing/receipts", permissions: ["wms.purchasing.read"] },
  { href: "/purchasing", permissions: ["wms.purchasing.read"] },
  { href: "/fulfillment", permissions: ["wms.fulfillment.read"] },
  { href: "/rts", permissions: ["wms.rts.read"] },
  { href: "/billing", permissions: ["wms.billing.read"] },
] as const;

function normalizePermissions(permissions?: string[]) {
  return Array.isArray(permissions)
    ? permissions.filter((permission) => typeof permission === "string")
    : [];
}

function hasPermission(permissions: string[], permission?: string) {
  if (!permission) {
    return true;
  }

  return permissions.includes(permission);
}

function hasAnyPermission(
  permissions: string[],
  requiredPermissions?: readonly string[],
) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.some((permission) =>
    permissions.includes(permission),
  );
}

export function hasAdminPermission(
  userRole?: string | null,
  permissions?: string[],
  permission?: string,
) {
  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  return hasPermission(normalizePermissions(permissions), permission);
}

export function hasAnyAdminPermission(
  userRole?: string | null,
  permissions?: string[],
  requiredPermissions?: readonly string[],
) {
  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  return hasAnyPermission(
    normalizePermissions(permissions),
    requiredPermissions,
  );
}

export function hasWmsWorkspaceAccess(
  userRole?: string | null,
  permissions?: string[],
) {
  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  return normalizePermissions(permissions).some((permission) =>
    permission.startsWith("wms."),
  );
}

export function canAccessAdminPath(
  pathname: string,
  userRole?: string | null,
  permissions?: string[],
) {
  if (!pathname) {
    return false;
  }

  if (userRole === "SUPER_ADMIN") {
    return true;
  }

  const normalizedPermissions = normalizePermissions(permissions);

  if (pathname === "/settings" || pathname.startsWith("/settings/profile")) {
    return hasPermission(
      normalizedPermissions,
      WMS_SETTINGS_PROFILE_PERMISSION,
    );
  }

  if (
    pathname.startsWith("/settings/users") ||
    pathname.startsWith("/settings/roles")
  ) {
    return false;
  }

  const moduleAccess = WMS_MODULE_ROUTE_PERMISSIONS.find(
    (route) => pathname === route.href || pathname.startsWith(`${route.href}/`),
  );

  if (!moduleAccess) {
    return false;
  }

  return hasAnyPermission(normalizedPermissions, moduleAccess.permissions);
}

export function getFirstAllowedAdminPath(
  userRole?: string | null,
  permissions?: string[],
) {
  if (userRole === "SUPER_ADMIN") {
    return "/partners";
  }

  const normalizedPermissions = normalizePermissions(permissions);

  if (hasPermission(normalizedPermissions, WMS_SETTINGS_PROFILE_PERMISSION)) {
    return "/settings/profile";
  }

  const firstModule = WMS_MODULE_ROUTE_PERMISSIONS.find((route) =>
    hasAnyPermission(normalizedPermissions, route.permissions),
  );

  return firstModule?.href || "/login";
}
