import apiClient from '@/lib/api-client';

export const ADMIN_PERMISSIONS_STORAGE_KEY = 'admin_permissions';

export type StoredAdminUser = {
  id?: string;
  userId?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  tenantId?: string | null;
  defaultTeamId?: string | null;
  role?: string;
};

export function readStoredAdminUser(): StoredAdminUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem('user');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAdminUser;
  } catch {
    return null;
  }
}

export function readStoredPermissions(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = localStorage.getItem(ADMIN_PERMISSIONS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function storePermissions(permissions: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(ADMIN_PERMISSIONS_STORAGE_KEY, JSON.stringify(permissions));
}

export function storeAdminUser(user: StoredAdminUser) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAdminSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('current_tenant_id');
  localStorage.removeItem('user');
  localStorage.removeItem(ADMIN_PERMISSIONS_STORAGE_KEY);
}

export async function fetchEffectivePermissions(
  workspace: 'erp' | 'wms' | 'all' = 'wms',
): Promise<string[]> {
  const response = await apiClient.get('/auth/permissions', {
    params: { workspace },
  });
  const permissions = response.data?.permissions;
  return Array.isArray(permissions)
    ? permissions.filter((value): value is string => typeof value === 'string')
    : [];
}
