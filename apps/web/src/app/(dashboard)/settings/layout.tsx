'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import apiClient from '@/lib/api-client';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // start with cached user perms if available
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (Array.isArray(parsed?.permissions)) {
          setPerms(parsed.permissions);
        }
      }
    } catch {
      // ignore
    }

    // refresh from API to ensure current permissions
    const fetchPerms = async () => {
      try {
        const res = await apiClient.get('/auth/permissions');
        const p: string[] = res?.data?.permissions || [];
        if (p.length) setPerms(p);
      } catch {
        // keep whatever we have
      }
    };
    fetchPerms();
  }, []);

  const tabs = useMemo(() => {
    const base = [{ href: '/settings/profile', label: 'Profile' }];
    if (perms.includes('team.read')) base.push({ href: '/settings/teams', label: 'Teams' });
    if (perms.includes('role.read')) base.push({ href: '/settings/roles', label: 'Roles' });
    if (perms.includes('user.read')) base.push({ href: '/settings/users', label: 'Users' });
    if (perms.includes('integration.webhook.read') || perms.includes('integration.webhook.update')) {
      base.push({ href: '/settings/webhook', label: 'Webhook' });
    }
    return base;
  }, [perms]);

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max sm:min-w-0 border-b border-slate-200">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
