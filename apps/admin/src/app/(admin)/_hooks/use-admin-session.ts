'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { hasWmsWorkspaceAccess } from '../_utils/access';

export type AdminUser = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  tenantId?: string | null;
};

export function useAdminSession() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_tenant_id');
    localStorage.removeItem('admin_permissions');
    localStorage.removeItem('user');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      const token = localStorage.getItem('access_token');
      const userStr = localStorage.getItem('user');

      if (!token || !userStr) {
        clearSession();
        router.push('/login');
        return;
      }

      try {
        const parsedUser = JSON.parse(userStr) as AdminUser;
        const storedPermissions = localStorage.getItem('admin_permissions');
        const cachedPermissions = storedPermissions ? (JSON.parse(storedPermissions) as string[]) : [];

        if (parsedUser.role === 'SUPER_ADMIN') {
          if (!cancelled) {
            setUser(parsedUser);
            setPermissions(Array.isArray(cachedPermissions) ? cachedPermissions : []);
            setIsLoading(false);
          }
          return;
        }

        const response = await apiClient.get<{ permissions?: string[] }>('/auth/permissions');
        const nextPermissions = Array.isArray(response.data?.permissions)
          ? response.data.permissions
          : [];

        if (!hasWmsWorkspaceAccess(parsedUser.role, nextPermissions)) {
          clearSession();
          router.push('/login');
          return;
        }

        localStorage.setItem('admin_permissions', JSON.stringify(nextPermissions));

        if (!cancelled) {
          setUser(parsedUser);
          setPermissions(nextPermissions);
          setIsLoading(false);
        }
      } catch {
        clearSession();
        router.push('/login');
      }
    };

    initializeSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, router]);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [clearSession, router]);

  return {
    user,
    permissions,
    isLoading,
    logout,
  };
}
