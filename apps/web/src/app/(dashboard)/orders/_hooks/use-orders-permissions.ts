'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { filterErpPermissions } from '@/lib/permission-workspace';

export function useOrdersPermissions() {
  const permissionsQuery = usePermissions();
  const [cachedPermissions, setCachedPermissions] = useState<string[]>([]);
  const [cachedPermissionsResolved, setCachedPermissionsResolved] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr) as { permissions?: unknown };
        setCachedPermissions(filterErpPermissions(parsed.permissions));
      }
    } catch {
      setCachedPermissions([]);
    } finally {
      setCachedPermissionsResolved(true);
    }
  }, []);

  const permissions = useMemo(
    () => permissionsQuery.data ?? cachedPermissions,
    [cachedPermissions, permissionsQuery.data],
  );

  const cachedHasOrdersAccess = useMemo(
    () =>
      cachedPermissions.includes('orders.summary.read')
      || cachedPermissions.includes('pos.read'),
    [cachedPermissions],
  );

  const shouldWaitForFreshPermissions =
    permissionsQuery.data === undefined
    && !permissionsQuery.isError
    && (!cachedPermissionsResolved || !cachedHasOrdersAccess);

  return {
    permissions,
    isLoading: shouldWaitForFreshPermissions,
    canViewOrdersSummary: permissions.includes('orders.summary.read'),
    canViewOrderConfirmation: permissions.includes('pos.read'),
  };
}
