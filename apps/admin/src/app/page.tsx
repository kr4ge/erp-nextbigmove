'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAdminSession,
  fetchEffectivePermissions,
  readStoredAdminUser,
  readStoredPermissions,
  storePermissions,
} from '@/lib/admin-session';
import { hasWmsAccess } from '@/lib/wms-access';

export default function AdminHomePage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function redirectToEntryPoint() {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const user = readStoredAdminUser();
      if (!user?.role) {
        clearAdminSession();
        router.replace('/login');
        return;
      }

      try {
        let permissions = readStoredPermissions();

        if (user.role !== 'SUPER_ADMIN') {
          permissions = await fetchEffectivePermissions();
          if (!isMounted) {
            return;
          }
          storePermissions(permissions);
        }

        if (!hasWmsAccess(user.role, permissions)) {
          clearAdminSession();
          router.replace('/login');
          return;
        }

        router.replace('/wms');
      } catch {
        clearAdminSession();
        router.replace('/login');
      }
    }

    void redirectToEntryPoint();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return null;
}
