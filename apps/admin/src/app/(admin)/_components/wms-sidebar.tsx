'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminUser } from '../_hooks/use-admin-session';
import type { WmsNavItem } from '../_constants/navigation';

type WmsSidebarProps = {
  pathname: string;
  user: AdminUser | null;
  navItems: WmsNavItem[];
  showSettingsLink: boolean;
  mobileOpen: boolean;
  isCollapsed: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  onLogout: () => void;
};

function SidebarContent({
  pathname,
  user,
  navItems,
  showSettingsLink,
  isCollapsed,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  user: AdminUser | null;
  navItems: WmsNavItem[];
  showSettingsLink: boolean;
  isCollapsed: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [pathname, isCollapsed]);

  useEffect(() => {
    const activeWithChildren = navItems.find(
      (item) =>
        item.children &&
        item.children.length > 0 &&
        item.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)),
    );

    if (activeWithChildren) {
      setExpandedItem(activeWithChildren.href);
    }
  }, [navItems, pathname]);

  const initials =
    `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim() || 'PA';

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'relative z-40 flex px-3 py-4 transition-all duration-300',
          isCollapsed ? 'justify-center' : 'flex-col items-center gap-3 text-center',
        )}
      >
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-orange-500 text-xl font-semibold text-white transition-all duration-300">
          WC
        </div>
        <div
          className={cn(
            'min-w-0 transition-all duration-300',
            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
          )}
        >
          <p className="whitespace-nowrap text-base font-semibold text-slate-900">
            Warehouse Connex
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <nav className="flex-1 space-y-2 px-2 py-4">
          {navItems.map(({ href, label, icon: Icon, children }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const hasChildren = Boolean(children && children.length > 0);
            const hasActiveChild = Boolean(
              children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)),
            );
            const isExpanded = expandedItem === href;

            if (hasChildren) {
              return (
                <div key={href} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCollapsed) {
                        router.push(children?.[0]?.href || href);
                        onNavigate?.();
                        return;
                      }
                      setExpandedItem((prev) => (prev === href ? null : href));
                    }}
                    className={cn(
                      'group flex w-full items-center rounded-xl px-3 py-3 transition-all duration-300',
                      isCollapsed ? 'justify-center' : '',
                      hasActiveChild || isExpanded
                        ? 'text-slate-800'
                        : 'text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex-shrink-0 transition-colors duration-300',
                        hasActiveChild || isExpanded
                          ? 'text-orange-500'
                          : 'text-slate-400 group-hover:text-orange-500',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div
                      className={cn(
                        'ml-3 flex-1 overflow-hidden text-left transition-all duration-300',
                        isCollapsed ? 'ml-0 w-0 opacity-0' : 'w-auto opacity-100',
                      )}
                    >
                      <span className="block whitespace-nowrap text-[0.82rem] font-semibold text-slate-900">
                        {label}
                      </span>
                    </div>
                    <svg
                      className={cn(
                        'h-4 w-4 text-slate-400 transition-all duration-300',
                        isExpanded ? 'rotate-90 text-orange-500' : '',
                        isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
                      )}
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l6 5-6 5" />
                    </svg>
                  </button>

                  {!isCollapsed && isExpanded ? (
                    <div className="ml-9 space-y-1">
                      {children!.map((child) => {
                        const childActive =
                          child.href === href
                            ? pathname === child.href
                            : pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[0.82rem] transition',
                              childActive
                                ? 'bg-orange-50 text-orange-700 shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-full',
                                childActive
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              <span className="h-2 w-2 rounded-full bg-current" />
                            </span>
                            <span className="font-medium">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'group flex items-center rounded-xl px-3 py-3 transition-all duration-300',
                  isCollapsed ? 'justify-center' : '',
                  active
                    ? 'bg-orange-50 text-orange-700 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'flex-shrink-0 transition-colors duration-300',
                    active
                      ? 'text-orange-500'
                      : 'text-slate-400 group-hover:text-orange-500',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div
                  className={cn(
                    'ml-3 flex-1 overflow-hidden transition-all duration-300',
                    isCollapsed ? 'ml-0 w-0 opacity-0' : 'w-auto opacity-100',
                  )}
                >
                  <span className="block whitespace-nowrap text-[0.82rem] font-semibold text-slate-900">
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            'sticky bottom-0 space-y-2 bg-white px-3 py-3 transition-all duration-300',
            isCollapsed ? 'px-2' : '',
          )}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className={cn(
                'w-full rounded-xl text-left transition-all duration-300 hover:bg-slate-50 focus:outline-none',
                isCollapsed ? 'flex justify-center px-0 py-2' : 'px-2.5 py-2',
              )}
            >
              <div
                className={cn(
                  'flex items-center transition-all duration-300',
                  isCollapsed ? 'justify-center' : 'gap-3',
                )}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                  {initials}
                </div>
                <div
                  className={cn(
                    'flex-1 overflow-hidden transition-all duration-300',
                    isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                  )}
                >
                  <div className="whitespace-nowrap text-[0.82rem] font-semibold text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                </div>
                <svg
                  className={cn(
                    'h-4 w-4 text-slate-500 transition-all duration-300',
                    isProfileMenuOpen ? 'rotate-180' : '',
                    isCollapsed ? 'w-0 opacity-0' : 'opacity-100',
                  )}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </button>

            {isProfileMenuOpen ? (
              <div
                className={cn(
                  'absolute bottom-full z-40 mb-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg',
                  isCollapsed ? 'left-2' : 'inset-x-0 w-auto',
                )}
              >
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <div className="text-[0.82rem] font-semibold text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="truncate text-xs text-slate-500">{user?.email}</div>
                </div>
                {showSettingsLink ? (
                  <Link
                    href="/settings/profile"
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-[0.82rem] text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span>Settings</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[0.82rem] text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4 text-slate-500" />
                  <span>Log out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WmsSidebar({
  pathname,
  user,
  navItems,
  showSettingsLink,
  mobileOpen,
  isCollapsed,
  onCloseMobile,
  onToggleCollapse,
  onLogout,
}: WmsSidebarProps) {
  const sidebarWidth = isCollapsed
    ? 'md:w-14 lg:w-14 xl:w-[60px]'
    : 'md:w-52 lg:w-56 xl:w-60';

  return (
    <>
      <aside
        className={cn(
          'relative hidden h-screen flex-col overflow-visible bg-white transition-all duration-300 ease-in-out z-40 md:sticky md:top-0 md:flex',
          sidebarWidth,
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-1/2 z-50 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-orange-300 hover:text-orange-600"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-300',
              isCollapsed ? 'rotate-180' : '',
            )}
          />
        </button>
        <SidebarContent
          pathname={pathname}
          user={user}
          navItems={navItems}
          showSettingsLink={showSettingsLink}
          isCollapsed={isCollapsed}
          onLogout={onLogout}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/25"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-center justify-end px-4 py-3">
              <button
                type="button"
                onClick={onCloseMobile}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              user={user}
              navItems={navItems}
              showSettingsLink={showSettingsLink}
              isCollapsed={false}
              onLogout={onLogout}
              onNavigate={onCloseMobile}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
