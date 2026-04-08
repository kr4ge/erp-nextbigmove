'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  WMS_SETTINGS_PROFILE_PERMISSION,
  WMS_SETTINGS_ROLES_PERMISSION,
  WMS_SETTINGS_USERS_PERMISSION,
} from '../../_utils/access';

const tabs = [
  { href: '/settings/profile', label: 'Profile', permission: WMS_SETTINGS_PROFILE_PERMISSION },
  { href: '/settings/users', label: 'Users', permission: WMS_SETTINGS_USERS_PERMISSION },
  { href: '/settings/roles', label: 'Roles', permission: WMS_SETTINGS_ROLES_PERMISSION },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedPermissions = localStorage.getItem('admin_permissions');

    try {
      const parsedUser = storedUser ? (JSON.parse(storedUser) as { role?: string }) : null;
      setUserRole(parsedUser?.role || null);
    } catch {
      setUserRole(null);
    }

    try {
      const parsedPermissions = storedPermissions ? JSON.parse(storedPermissions) : [];
      setPermissions(Array.isArray(parsedPermissions) ? parsedPermissions : []);
    } catch {
      setPermissions([]);
    }
  }, [pathname]);

  const visibleTabs = useMemo(() => {
    if (userRole === 'SUPER_ADMIN') {
      return tabs;
    }

    return tabs.filter((tab) => tab.href === '/settings/profile' && permissions.includes(tab.permission));
  }, [permissions, userRole]);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-6 border-b border-slate-200">
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
