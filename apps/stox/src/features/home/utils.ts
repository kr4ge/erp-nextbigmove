import type { BootstrapResponse, LoginUser } from '@/src/features/auth/types';

export function getDisplayName(user: LoginUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

export function getInitials(label: string) {
  const [first = '', second = ''] = label
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase());

  return `${first}${second}` || 'ST';
}

export function resolveEntityName<T extends { id: string }>(
  items: T[],
  id: string | null,
  key: keyof T = 'name' as keyof T,
) {
  if (!id) {
    return 'Not set';
  }

  const match = items.find((item) => item.id === id);
  const rawValue = match?.[key];

  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : id;
}

export function resolveHomeContext(bootstrap: BootstrapResponse) {
  const warehouse = resolveEntityName(
    bootstrap.context.warehouses,
    bootstrap.context.defaultWarehouseId,
    'name',
  );
  const store = resolveEntityName(bootstrap.context.stores, bootstrap.context.defaultStoreId);

  if (warehouse !== 'Not set') {
    return warehouse;
  }

  if (store !== 'Not set') {
    return store;
  }

  return bootstrap.tenant?.name || 'Private workspace';
}
