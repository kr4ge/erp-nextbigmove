'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import {
  clearAdminSession,
  fetchEffectivePermissions,
  readStoredAdminUser,
  readStoredPermissions,
  storePermissions,
  type StoredAdminUser,
} from '@/lib/admin-session';
import { hasWmsAccess, WMS_NAV_ITEMS } from '@/lib/wms-access';
import { WmsSidebarBrand } from './wms-sidebar-brand';
import { WmsTopbar } from './wms-topbar';

type WmsShellState = {
  user: StoredAdminUser;
  permissions: string[];
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'wms.sidebar.collapsed';

export function WmsShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<WmsShellState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    setIsSidebarCollapsed(stored === '1');
    setHasLoadedSidebarPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPreference) {
      return;
    }

    localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, isSidebarCollapsed ? '1' : '0');
  }, [hasLoadedSidebarPreference, isSidebarCollapsed]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateShell() {
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
          storePermissions(permissions);
        }

        if (!hasWmsAccess(user.role, permissions)) {
          clearAdminSession();
          router.replace('/login');
          return;
        }

        if (!isMounted) {
          return;
        }

        setState({ user, permissions });
        setIsLoading(false);
      } catch {
        clearAdminSession();
        router.replace('/login');
      }
    }

    hydrateShell();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const navItems = useMemo(() => {
    if (!state) {
      return [];
    }

    const isPlatformAdmin = state.user.role === 'SUPER_ADMIN';

    return WMS_NAV_ITEMS.filter((item) => {
      const itemAllowed =
        (!item.platformOnly || isPlatformAdmin)
        && (!item.permission || isPlatformAdmin || state.permissions.includes(item.permission));

      const visibleChildren =
        item.children?.filter((child) => {
          if (child.platformOnly && !isPlatformAdmin) {
            return false;
          }

          return !child.permission || isPlatformAdmin || state.permissions.includes(child.permission);
        }) ?? [];

      return itemAllowed || visibleChildren.length > 0;
    }).map((item) => ({
      ...item,
      children:
        item.children?.filter((child) => {
          if (child.platformOnly && !isPlatformAdmin) {
            return false;
          }

          return !child.permission || isPlatformAdmin || state.permissions.includes(child.permission);
        }) ?? [],
    }));
  }, [state]);

  useEffect(() => {
    setExpandedItems((current) => {
      let changed = false;
      const next = { ...current };

      for (const item of navItems) {
        if (!item.children.length) {
          continue;
        }

        const shouldOpen = item.children.some(
          (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
        );

        if (shouldOpen && !current[item.label] && !isSidebarCollapsed) {
          next[item.label] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [isSidebarCollapsed, navItems, pathname]);

  const handleLogout = () => {
    clearAdminSession();
    router.replace('/login');
  };

  if (isLoading || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f4eb]">
        <div className="rounded-[28px] border border-[#dce4ea] bg-white px-6 py-5 text-sm font-medium text-[#537082] shadow-[0_20px_60px_-40px_rgba(18,56,75,0.45)]">
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4eb] text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen lg:h-screen">
        <aside
          style={{
            width: isSidebarCollapsed ? 'var(--wms-sidebar-collapsed-width)' : 'var(--wms-sidebar-width)',
          }}
          className="relative z-40 hidden h-screen shrink-0 border-r border-[#214c63] bg-[#12384b] text-slate-100 transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:flex-col"
        >
          <div
            className={`wms-rail flex items-center border-b border-white/10 ${
              isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-5'
            }`}
          >
            <WmsSidebarBrand collapsed={isSidebarCollapsed} />
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/88 transition hover:bg-white/10 hover:text-white ${
                isSidebarCollapsed ? '' : 'ml-auto'
              }`}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav
            className={`min-h-0 flex-1 space-y-1.5 overflow-x-visible overflow-y-auto pb-4 pt-4 ${
              isSidebarCollapsed ? 'px-3' : 'px-4'
            }`}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children.length > 0;
              const isActive = item.href
                ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                : false;
              const isChildActive = hasChildren
                ? item.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))
                : false;
              const isExpanded = expandedItems[item.label] ?? (!isSidebarCollapsed && isChildActive);

              if (hasChildren) {
                return (
                  <div key={item.label} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItems((current) => ({
                          ...current,
                          [item.label]: !isExpanded,
                        }))
                      }
                      className={`flex w-full items-center rounded-full py-3 text-[length:var(--wms-nav-font-size)] font-medium transition ${
                        isChildActive || isExpanded
                          ? 'bg-white/10 text-white'
                          : 'text-white/88 hover:bg-white/8 hover:text-white'
                      } ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-4 text-left'}`}
                      aria-label={item.label}
                      title={isSidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className="h-[var(--wms-nav-icon-size)] w-[var(--wms-nav-icon-size)] shrink-0" />
                      {!isSidebarCollapsed ? <span className="flex-1">{item.label}</span> : null}
                      {!isSidebarCollapsed ? (
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      ) : null}
                    </button>

                    {isSidebarCollapsed ? (
                      <div
                        className={`absolute left-[calc(100%+0.75rem)] top-0 z-50 w-56 rounded-[20px] border border-[#dce4ea] bg-white p-2 text-[#12384b] shadow-[0_24px_50px_-32px_rgba(18,56,75,0.45)] transition ${
                          isExpanded
                            ? 'visible translate-x-0 opacity-100'
                            : 'invisible -translate-x-1 opacity-0'
                        }`}
                      >
                        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8193a0]">
                          {item.label}
                        </p>
                        <div className="space-y-1">
                          {item.children.map((child) => {
                            const childActive =
                              pathname === child.href || pathname.startsWith(`${child.href}/`);

                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                prefetch={false}
                                className={`flex items-center gap-2 rounded-[14px] px-3 py-2.5 text-[12px] font-medium transition ${
                                  childActive
                                    ? 'bg-[#fff7ed] text-[#c2410c]'
                                    : 'text-[#4d6677] hover:bg-[#f6f8fa] hover:text-[#12384b]'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    childActive ? 'bg-[#f97316]' : 'bg-[#bfd0db]'
                                  }`}
                                />
                                <span>{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`overflow-hidden pl-5 pr-1 transition-all duration-200 ${
                          isExpanded ? 'max-h-48 pt-1 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="border-l border-white/10 pl-3">
                          {item.children.map((child) => {
                            const childActive =
                              pathname === child.href || pathname.startsWith(`${child.href}/`);

                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                prefetch={false}
                                className={`mb-1 flex items-center gap-2 rounded-2xl px-3 py-2 text-[12.5px] font-medium transition ${
                                  childActive
                                    ? 'bg-[#f7cf5f] text-[#12384b] shadow-[0_18px_32px_-28px_rgba(247,207,95,0.9)]'
                                    : 'text-white/78 hover:bg-white/8 hover:text-white'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    childActive ? 'bg-[#12384b]' : 'bg-white/45'
                                  }`}
                                />
                                <span>{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href ?? item.label}
                  href={item.href ?? '/'}
                  prefetch={false}
                  aria-label={item.label}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-full py-3 text-[length:var(--wms-nav-font-size)] font-medium transition ${
                    isActive
                      ? 'bg-[#f7cf5f] text-[#12384b] shadow-[0_20px_40px_-30px_rgba(247,207,95,0.85)]'
                      : 'text-white/88 hover:bg-white/8 hover:text-white'
                  } ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3.5 px-4'}`}
                >
                  <Icon className="h-[var(--wms-nav-icon-size)] w-[var(--wms-nav-icon-size)] shrink-0" />
                  {!isSidebarCollapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden lg:h-screen lg:min-h-0 lg:overflow-hidden">
          <div className="sticky top-0 z-30 shrink-0">
            <WmsTopbar user={state.user} onLogout={handleLogout} />
          </div>

          <main className="wms-shell-main min-h-0 min-w-0 flex-1 overflow-x-hidden lg:overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
