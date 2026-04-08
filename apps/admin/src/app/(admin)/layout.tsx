'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { WmsShellLoading } from './_components/wms-shell-loading';
import { WmsSidebar } from './_components/wms-sidebar';
import { WmsTopbar } from './_components/wms-topbar';
import { WMS_NAV_ITEMS } from './_constants/navigation';
import { useAdminSession } from './_hooks/use-admin-session';
import {
  canAccessAdminPath,
  getFirstAllowedAdminPath,
  hasAnyAdminPermission,
  WMS_SETTINGS_PROFILE_PERMISSION,
} from './_utils/access';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, permissions, isLoading, logout } = useAdminSession();

  useEffect(() => {
    const stored = localStorage.getItem('wms_sidebar_collapsed');
    setIsSidebarCollapsed(stored === 'true');
  }, []);

  const filteredNavItems = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') {
      return WMS_NAV_ITEMS;
    }

    return WMS_NAV_ITEMS.flatMap((item) => {
      const visibleChildren = item.children?.filter((child) =>
        hasAnyAdminPermission(user?.role, permissions, child.requiredPermissions),
      );

      const parentAllowed = hasAnyAdminPermission(user?.role, permissions, item.requiredPermissions);
      const shouldInclude = parentAllowed || (visibleChildren && visibleChildren.length > 0);

      if (!shouldInclude) {
        return [];
      }

      return [
        {
          ...item,
          children: visibleChildren,
        },
      ];
    });
  }, [permissions, user?.role]);

  const canAccessSettings =
    user?.role === 'SUPER_ADMIN' || permissions.includes(WMS_SETTINGS_PROFILE_PERMISSION);
  const isPathAllowed = user ? canAccessAdminPath(pathname, user.role, permissions) : false;

  useEffect(() => {
    if (isLoading || !user || isPathAllowed) {
      return;
    }

    router.replace(getFirstAllowedAdminPath(user.role, permissions));
  }, [isLoading, isPathAllowed, pathname, permissions, router, user]);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('wms_sidebar_collapsed', String(next));
      return next;
    });
  };

  if (isLoading) {
    return <WmsShellLoading />;
  }

  if (!user) {
    return null;
  }

  if (!isPathAllowed) {
    return <WmsShellLoading />;
  }

  return (
    <div className="wms-density-compact flex h-screen overflow-hidden bg-white text-slate-900">
      <WmsSidebar
        pathname={pathname}
        user={user}
        navItems={filteredNavItems}
        showSettingsLink={canAccessSettings}
        mobileOpen={mobileOpen}
        isCollapsed={isSidebarCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={handleSidebarToggle}
        onLogout={logout}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <WmsTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-100 lg:rounded-tl-[1.75rem]">
          <div className="mx-auto h-full w-full max-w-[1560px] px-3 py-4 sm:px-4 lg:px-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
