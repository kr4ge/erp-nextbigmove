'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { filterErpPermissions } from '@/lib/permission-workspace';

export default function TeamPerformanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [perms, setPerms] = useState<string[]>([]);
  const [isLoadingPerms, setIsLoadingPerms] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const userStr = window.localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setPerms(filterErpPermissions(parsed?.permissions));
      }
    } catch {
      // ignore malformed cached user payloads
    }

    const fetchPerms = async () => {
      try {
        const response = await apiClient.get('/auth/permissions', {
          params: { workspace: 'erp' },
        });
        setPerms(filterErpPermissions(response?.data?.permissions || []));
      } catch {
        // keep cached perms
      } finally {
        setIsLoadingPerms(false);
      }
    };

    void fetchPerms();
  }, []);

  const tabs = useMemo(() => {
    const nextTabs: Array<{ href: string; label: string }> = [];
    const hasSales = perms.includes('analytics.sales');
    const hasMarketing = perms.includes('analytics.marketing');

    if (hasSales) {
      nextTabs.push({ href: '/analytics/team-performance/sales', label: 'Sales by Team' });
    }

    if (hasMarketing) {
      nextTabs.push({ href: '/analytics/team-performance/marketing', label: 'Marketing' });
    }

    return nextTabs;
  }, [perms]);

  useEffect(() => {
    if (isLoadingPerms) return;

    if (tabs.length === 0) {
      router.replace('/analytics');
      return;
    }

    const isRootPath = pathname === '/analytics/team-performance';
    const isAllowedPath = tabs.some((tab) => pathname === tab.href || pathname?.startsWith(`${tab.href}/`));

    if (isRootPath || !isAllowedPath) {
      router.replace(tabs[0].href);
    }
  }, [isLoadingPerms, pathname, router, tabs]);

  if (isLoadingPerms) {
    return (
      <div className="space-y-6">
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-6 border-b border-slate-200 sm:min-w-0 dark:border-border" />
        </div>
      </div>
    );
  }

  if (tabs.length === 0) {
    return null;
  }

  const isRootPath = pathname === '/analytics/team-performance';
  const isAllowedPath = tabs.some((tab) => pathname === tab.href || pathname?.startsWith(`${tab.href}/`));
  if (isRootPath || !isAllowedPath) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-6 border-b border-slate-200 sm:min-w-0 dark:border-border">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-b-2 border-primary text-orange-600'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
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
