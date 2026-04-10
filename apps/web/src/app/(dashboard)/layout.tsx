'use client';

import { ReactNode, useEffect, useState, useRef, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Layers,
  StoreIcon,
  Network,
  BarChart3,
  ClipboardList,
  Target,
  Package,
  FileSpreadsheet,
  Menu,
  X
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { ToastProvider } from '@/components/ui/toast';
import { filterErpPermissions } from '@/lib/permission-workspace';

interface NavLink {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  children?: { href: string; label: string; icon?: ReactNode }[];
}

const iconClasses = 'h-4 w-4';
const MOBILE_DRAWER_TRANSITION_MS = 220;

const baseNavigation: NavLink[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Snapshot of your business',
    icon: (
      <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 9.5 12 4l9 5.5v9.75a.75.75 0 0 1-.75.75H4.75A.75.75 0 0 1 4 19.25V9.5Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Reports & performance',
    icon: (
      <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h3v8H5zM10.5 8h3v12h-3zM16 4h3v16h-3z" />
      </svg>
    ),
    children: [
      { href: '/analytics/sales', label: 'Sales', icon: <StoreIcon className="h-4 w-4" /> },
      { href: '/analytics/sales-performance', label: 'Sales Performance', icon: <BarChart3 className="h-4 w-4" /> },
      { href: '/analytics/marketing', label: 'Marketing', icon: <Network className="h-4 w-4" /> },
    ],
  },
  {
    href: '/integrations',
    label: 'Integrations',
    description: 'Manage connected apps',
    icon: (
      <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7h8m-4-4v8m-7 3h6m6 0h6m-9 0v6m-3-6v6"
        />
      </svg>
    ),
    children: [
      { href: '/integrations', label: 'Create Integration', icon: <Layers className="h-4 w-4" /> },
      { href: '/integrations/store', label: 'Stores', icon: <StoreIcon className="h-4 w-4" /> },
      { href: '/integrations/meta', label: 'Meta', icon: <Network className="h-4 w-4" /> },
    ],
  },
  {
    href: '/workflows',
    label: 'Workflows',
    description: 'Automated data sync',
    icon: (
      <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 7h16M4 12h16M4 17h16"
        />
        <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
        <circle cx="7" cy="17" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/requests',
    label: 'Stock Requests',
    description: 'Inventory request coordination with WMS',
    icon: <Package className={iconClasses} />,
  },
  {
    href: '/orders',
    label: 'Orders',
    description: 'Order operations queue',
    icon: <ClipboardList className={iconClasses} />,
    children: [
      { href: '/orders/confirmation', label: 'Confirmation of Order', icon: <ClipboardList className="h-4 w-4" /> },
    ],
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'Tenant-wide POS exports',
    icon: <FileSpreadsheet className={iconClasses} />,
  },
  {
    href: '/kpis',
    label: 'KPIs',
    description: 'Targets & performance tracking',
    icon: <Target className={iconClasses} />,
    children: [
      { href: '/kpis/marketing', label: 'Marketing', icon: <Target className="h-4 w-4" /> },
      { href: '/kpis/funnel', label: 'Funnel', icon: <Target className="h-4 w-4" /> },
      { href: '/kpis/sales', label: 'Sales', icon: <Target className="h-4 w-4" /> },
    ],
  },
];

type DashboardLayoutUser = {
  userId?: string;
  id?: string;
  tenantId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  permissions?: string[];
  tenant?: {
    name?: string;
  };
};

type DashboardLayoutTenant = {
  id?: string;
  status?: string;
  name?: string;
};

type DashboardLayoutTeam = {
  id: string;
  name?: string;
  teamCode?: string;
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<DashboardLayoutUser | null>(null);
  const [tenant, setTenant] = useState<DashboardLayoutTenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [teams, setTeams] = useState<DashboardLayoutTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [canViewAllTeams, setCanViewAllTeams] = useState(false);
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [collapsedPopupItem, setCollapsedPopupItem] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const navButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const mobileNavCloseTimerRef = useRef<number | null>(null);

  const openMobileNav = () => {
    if (typeof window === 'undefined') {
      setIsMobileNavMounted(true);
      setIsMobileNavOpen(true);
      return;
    }

    if (mobileNavCloseTimerRef.current !== null) {
      window.clearTimeout(mobileNavCloseTimerRef.current);
      mobileNavCloseTimerRef.current = null;
    }

    setIsMobileNavMounted(true);
    window.requestAnimationFrame(() => {
      setIsMobileNavOpen(true);
    });
  };

  const closeMobileNav = () => {
    if (typeof window === 'undefined') {
      setIsMobileNavOpen(false);
      setIsMobileNavMounted(false);
      return;
    }

    setIsMobileNavOpen(false);

    if (mobileNavCloseTimerRef.current !== null) {
      window.clearTimeout(mobileNavCloseTimerRef.current);
    }

    mobileNavCloseTimerRef.current = window.setTimeout(() => {
      setIsMobileNavMounted(false);
      mobileNavCloseTimerRef.current = null;
    }, MOBILE_DRAWER_TRANSITION_MS);
  };

  const filteredNavigation = useMemo<NavLink[]>(() => {
    const hasMarketing = permissions.includes('analytics.marketing');
    const hasSales = permissions.includes('analytics.sales');
    const hasSalesPerformance = permissions.includes('analytics.sales_performance');
    const hasIntegrations = permissions.includes('integration.read');
    const hasStores = permissions.includes('pos.read');
    const hasMeta = permissions.includes('meta.read');
    const hasWorkflow = permissions.includes('workflow.read');
    const hasStockRequests =
      permissions.includes('stock_request.read')
      || permissions.includes('stock_request.write');
    const hasOrderConfirmation = permissions.includes('pos.read');
    const hasReports = permissions.includes('reports.pos_orders.read');
    const hasMarketingKpi = permissions.includes('kpi.marketing.read') || permissions.includes('kpi.marketing.manage');
    const hasFunnelKpi = permissions.includes('kpi.funnel.read');
    const hasSalesKpi = permissions.includes('kpi.sales.read');

    return baseNavigation.flatMap((link) => {
      if (link.href !== '/analytics') {
        if (link.href === '/workflows') {
          return hasWorkflow ? [link] : [];
        }
        if (link.href === '/requests') {
          return hasStockRequests ? [link] : [];
        }
        if (link.href === '/orders') {
          const children = (link.children || []).filter((child) => {
            if (child.href === '/orders/confirmation') return hasOrderConfirmation;
            return false;
          });
          if (children.length === 0) return [];
          return [{ ...link, children }];
        }
        if (link.href === '/reports') {
          return hasReports ? [link] : [];
        }
        if (link.href === '/kpis') {
          const children = (link.children || []).filter((child) => {
            if (child.href === '/kpis/marketing') return hasMarketingKpi;
            if (child.href === '/kpis/funnel') return hasFunnelKpi;
            if (child.href === '/kpis/sales') return hasSalesKpi;
            return false;
          });
          if (children.length === 0) return [];
          return [{ ...link, children }];
        }
        if (link.href !== '/integrations') return [link];

        const children = (link.children || []).filter((child) => {
          if (child.href === '/integrations') return hasIntegrations;
          if (child.href === '/integrations/store') return hasStores;
          if (child.href === '/integrations/meta') return hasMeta;
          return false;
        });

        if (children.length === 0) return [];
        return [{ ...link, children }];
      }

      const children = (link.children || []).filter((child) => {
        if (child.href === '/analytics/marketing') return hasMarketing;
        if (child.href === '/analytics/sales') return hasSales;
        if (child.href === '/analytics/sales-performance') return hasSalesPerformance;
        return false;
      });

      if (children.length === 0) return [];
      return [{ ...link, children }];
    });
  }, [permissions]);


  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');
    const tenantStr = localStorage.getItem('tenant');
    const storedTenantId = localStorage.getItem('current_tenant_id');
    const storedTeamIds = localStorage.getItem('current_team_ids');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userStr) {
      const parsedUser = JSON.parse(userStr) as DashboardLayoutUser;
      setUser(parsedUser);
      const perms = filterErpPermissions(parsedUser.permissions);
      if (perms.includes('team.read_all') || perms.includes('permission.assign')) {
        setCanViewAllTeams(true);
      }
      setPermissions(perms);
      // Ensure tenant context from user if missing
      if (!storedTenantId && parsedUser?.tenantId) {
        localStorage.setItem('current_tenant_id', parsedUser.tenantId);
      }
    }
    if (tenantStr) {
      const parsedTenant = JSON.parse(tenantStr) as DashboardLayoutTenant;
      setTenant(parsedTenant);
      // Ensure tenant context is set for permission calls
      if (!storedTenantId && parsedTenant?.id) {
        localStorage.setItem('current_tenant_id', parsedTenant.id);
      }
    }
    if (storedTeamIds) {
      try {
        const arr = JSON.parse(storedTeamIds);
        if (Array.isArray(arr)) {
          setSelectedTeamIds(arr.filter((t) => typeof t === 'string' && t.length > 0));
        }
      } catch {
        // ignore
      }
    } else {
      // Default to all teams (empty selection)
      setSelectedTeamIds([]);
      localStorage.setItem('current_team_ids', JSON.stringify([]));
      localStorage.setItem('current_team_id', '');
    }

    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    const normalized = pathname?.split('?')[0] || '/';
    const activeWithChildren = filteredNavigation.find(
      (link) => link.children && link.children.length > 0 && (normalized === link.href || normalized.startsWith(`${link.href}/`))
    );
    if (activeWithChildren) {
      setExpandedItem(activeWithChildren.href);
    }
  }, [pathname, filteredNavigation]);

  useEffect(() => {
    const uid = user?.userId || user?.id;
    if (!user || !uid || !user.tenantId) return;
    const checkPermissions = async () => {
      try {
        const response = await apiClient.get('/auth/permissions', {
          params: { workspace: 'erp' },
        });
        const permissions = response.data.permissions || [];
        const hasAllTeams = permissions.includes('team.read_all') || permissions.includes('permission.assign');
        setCanViewAllTeams(hasAllTeams);
        setPermissions(permissions);
      } catch {
        // Keep current state if fetch fails
        setCanViewAllTeams((prev) => prev);
      }
    };
    checkPermissions();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    setIsLoadingTeams(true);
    const endpoint = canViewAllTeams ? '/teams' : '/teams/my-teams';
    apiClient
      .get(endpoint)
      .then((res) => {
        const list = Array.isArray(res.data) ? (res.data as DashboardLayoutTeam[]) : [];
        setTeams(list);
        const storedIds = localStorage.getItem('current_team_ids');
        let initialIds: string[] = [];
        if (storedIds) {
          try {
            const parsed = JSON.parse(storedIds);
            if (Array.isArray(parsed)) {
              initialIds = parsed.filter((t) => typeof t === 'string' && t.length > 0);
            }
          } catch {
            // ignore
          }
        }
        if (initialIds.length === 0) {
          // Default to "All teams" (empty selection means all)
          initialIds = [];
          localStorage.setItem('current_team_ids', JSON.stringify([]));
          localStorage.setItem('current_team_id', '');
        }
        setSelectedTeamIds(initialIds);
      })
      .catch(() => {
        setTeams([]);
      })
      .finally(() => setIsLoadingTeams(false));
  }, [user, canViewAllTeams]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_tenant_id');
    localStorage.removeItem('tenant');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleTeamSelection = (teamId: string) => {
    let next: string[] = [];
    if (teamId === '__all__') {
      next = [];
    } else {
      if (selectedTeamIds.includes(teamId)) {
        next = selectedTeamIds.filter((id) => id !== teamId);
      } else {
        next = [...selectedTeamIds, teamId];
      }
    }
    setSelectedTeamIds(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_team_ids', JSON.stringify(next));
      localStorage.setItem('current_team_id', next[0] || '');
      window.dispatchEvent(new CustomEvent('teamScopeChanged', { detail: next }));
    }
    setIsTeamMenuOpen(false);
    router.refresh();
  };

  const handleOnlySelection = (teamId: string) => {
    const next = teamId === '__all__' ? [] : [teamId];
    setSelectedTeamIds(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_team_ids', JSON.stringify(next));
      localStorage.setItem('current_team_id', next[0] || '');
      window.dispatchEvent(new CustomEvent('teamScopeChanged', { detail: next }));
    }
    setIsTeamMenuOpen(false);
    router.refresh();
  };

  const organizationName =
    tenant?.name || user?.tenant?.name || 'ERP Analytics';

  useEffect(() => {
    setIsProfileMenuOpen(false);
    setIsMobileNavOpen(false);
    setIsMobileNavMounted(false);
    setCollapsedPopupItem(null);
  }, [pathname]);

  // Close collapsed popup when sidebar expands
  useEffect(() => {
    if (!isSidebarCollapsed) {
      setCollapsedPopupItem(null);
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isMobileNavMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavMounted]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && mobileNavCloseTimerRef.current !== null) {
        window.clearTimeout(mobileNavCloseTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-300"></div>
      </div>
    );
  }

  const sidebarWidth = isSidebarCollapsed ? 'md:w-14 lg:w-14 xl:w-[60px]' : 'md:w-52 lg:w-56 xl:w-60';

  return (
    <ToastProvider>
      <div className="h-screen bg-white text-slate-900 flex">
        {/* Sidebar */}
        <aside
          className={`relative hidden md:flex ${sidebarWidth} flex-col bg-white transition-all duration-300 ease-in-out h-screen sticky top-0 overflow-visible z-40`}
        >
          {/* Collapse toggle pinned to the right edge, vertically centered */}
          <button
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="absolute -right-3 top-1/2 z-50 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-orange-300 hover:text-orange-600 transition-all duration-300"
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
            </svg>
          </button>
          <div
            className={`px-3 py-4 flex relative z-40 transition-all duration-300 ${
              isSidebarCollapsed ? 'justify-center' : 'flex-col items-center gap-3 text-center'
            }`}
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-orange-500 text-xl font-semibold text-white transition-all duration-300">
              {organizationName
                .split(' ')
                .map((word: string) => word.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'EA'}
            </div>
            <div className={`min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
              <p className="whitespace-nowrap text-base font-semibold text-slate-900">{organizationName}</p>
            </div>
          </div>

        {/* Scrollable nav and profile section */}
          <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <nav className="flex-1 px-2 py-4 space-y-2">
          {filteredNavigation.map((link) => {
            const normalizedPath = pathname?.split('?')[0] || '/';
            const isActive =
              normalizedPath === link.href ||
              (link.href !== '/dashboard' && normalizedPath.startsWith(`${link.href}/`));
            const hasChildren = link.children && link.children.length > 0;
            const isExpanded = expandedItem === link.href;
            const hasActiveChild =
              hasChildren && link.children!.some((child) => normalizedPath === child.href || normalizedPath.startsWith(`${child.href}/`));

            return (
              <div key={link.href} className="relative">
                <div className="space-y-1">
                  {hasChildren ? (
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) navButtonRefs.current.set(link.href, el);
                      }}
                      onClick={(e) => {
                        if (isSidebarCollapsed) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPopupPosition({ top: rect.top, left: rect.right + 8 });
                          setCollapsedPopupItem((prev) => (prev === link.href ? null : link.href));
                        } else {
                          setExpandedItem((prev) => (prev === link.href ? null : link.href));
                        }
                      }}
                      className={`group flex w-full items-center rounded-xl px-3 py-3 transition-all duration-300 ${
                        isSidebarCollapsed ? 'justify-center' : ''
                      } ${hasActiveChild || isExpanded || (isSidebarCollapsed && collapsedPopupItem === link.href) ? 'text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <span
                        className={`flex-shrink-0 transition-colors duration-300 ${
                          hasActiveChild || isExpanded || (isSidebarCollapsed && collapsedPopupItem === link.href) ? 'text-orange-500' : 'text-slate-400'
                        } group-hover:text-orange-500`}
                      >
                        {link.icon}
                      </span>
                      <div className={`ml-3 flex-1 text-left transition-all duration-300 overflow-hidden ${
                        isSidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'
                      }`}>
                        <span className="text-[0.82rem] font-semibold block text-slate-900 whitespace-nowrap">{link.label}</span>
                      </div>
                      <svg
                        className={`h-4 w-4 text-slate-400 transition-all duration-300 ${
                          isExpanded ? 'rotate-90 text-orange-500' : ''
                        } ${isSidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l6 5-6 5" />
                      </svg>
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      className={`group flex items-center rounded-xl px-3 py-3 transition-all duration-300 ${
                        isActive ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                      } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    >
                      <span
                        className={`flex-shrink-0 transition-colors duration-300 ${
                          isActive ? 'text-orange-500' : 'text-slate-400'
                        } group-hover:text-orange-500`}
                      >
                        {link.icon}
                      </span>
                      <div className={`ml-3 flex-1 transition-all duration-300 overflow-hidden ${
                        isSidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'
                      }`}>
                        <span className="text-[0.82rem] font-semibold block text-slate-900 whitespace-nowrap">{link.label}</span>
                      </div>
                    </Link>
                  )}
                  {/* Expanded submenu when sidebar is open */}
                  {hasChildren && !isSidebarCollapsed && isExpanded && (
                    <div className="ml-9 space-y-1">
                      {link.children!.map((child) => {
                        const isRootIntegration = child.href === '/integrations';
                        const childActive = isRootIntegration
                          ? normalizedPath === child.href
                          : normalizedPath === child.href || normalizedPath.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[0.82rem] transition ${
                              childActive
                                ? 'bg-orange-50 text-orange-700 shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              childActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                              {child.icon ?? <span className="h-4 w-4" />}
                            </span>
                            <span className="font-medium">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={`px-3 py-3 space-y-3 sticky bottom-0 bg-white transition-all duration-300 ${isSidebarCollapsed ? 'px-2' : ''}`}>
          <div className="relative">
            <button
              onClick={() => isSidebarCollapsed ? handleLogout() : setIsProfileMenuOpen((prev) => !prev)}
              className={`w-full rounded-xl text-left hover:bg-slate-50 focus:outline-none transition-all duration-300 ${
                isSidebarCollapsed ? 'px-0 py-2 flex justify-center' : 'px-3 py-2'
              }`}
            >
              <div className={`flex items-center transition-all duration-300 ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                  {`${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim() || '??'}
                </div>
                <div className={`flex-1 transition-all duration-300 overflow-hidden ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                  <div className="text-[0.82rem] font-semibold text-slate-900 whitespace-nowrap">
                    {user?.firstName} {user?.lastName}
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-all duration-300 ${isProfileMenuOpen ? 'rotate-180' : ''} ${isSidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M6 8l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {isProfileMenuOpen && !isSidebarCollapsed && (
              <div className="absolute inset-x-0 bottom-full mb-2 rounded-2xl border border-slate-200 bg-white shadow-lg z-40">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-[0.82rem] font-semibold text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                </div>
                <Link
                  href="/settings/profile"
                  className="flex items-center gap-3 px-4 py-3 text-[0.82rem] text-slate-700 hover:bg-slate-50"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <path
                      d="M4.5 10a5.5 5.5 0 0 1 10 0 5.5 5.5 0 0 1-10 0Zm5.5-3v3l2 1"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-[0.82rem] text-slate-700 hover:bg-slate-50"
                >
                  <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <path d="M11 5v10M7 9l-2 2 2 2M11 10H4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </aside>

      {isMobileNavMounted ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className={`absolute inset-0 bg-slate-950/25 transition-opacity duration-200 ${
              isMobileNavOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeMobileNav}
          />
          <aside
            className={`absolute inset-y-0 left-0 flex w-[85vw] max-w-sm flex-col bg-white shadow-xl transition-transform duration-200 ease-out ${
              isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex items-center justify-end px-4 py-3">
              <button
                type="button"
                onClick={closeMobileNav}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative z-40 flex flex-col items-center gap-3 px-3 py-4 text-center">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[1.35rem] bg-orange-500 text-xl font-semibold text-white">
                {organizationName
                  .split(' ')
                  .map((word: string) => word.charAt(0))
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'EA'}
              </div>
              <div className="min-w-0">
                <p className="whitespace-nowrap text-base font-semibold text-slate-900">{organizationName}</p>
              </div>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
              {filteredNavigation.map((link) => {
                const normalizedPath = pathname?.split('?')[0] || '/';
                const isActive =
                  normalizedPath === link.href ||
                  (link.href !== '/dashboard' && normalizedPath.startsWith(`${link.href}/`));
                const hasChildren = Boolean(link.children && link.children.length > 0);
                const isExpanded = expandedItem === link.href;
                const hasActiveChild = Boolean(
                  link.children?.some(
                    (child) => normalizedPath === child.href || normalizedPath.startsWith(`${child.href}/`),
                  ),
                );

                return (
                  <div key={`mobile-${link.href}`} className="space-y-1">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => setExpandedItem((prev) => (prev === link.href ? null : link.href))}
                        className={`group flex w-full items-center rounded-xl px-3 py-3 transition-all duration-300 ${
                          hasActiveChild || isExpanded ? 'text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 transition-colors duration-300 ${
                            hasActiveChild || isExpanded
                              ? 'text-orange-500'
                              : 'text-slate-400 group-hover:text-orange-500'
                          }`}
                        >
                          {link.icon}
                        </span>
                        <span className="ml-3 flex-1 text-left text-[0.82rem] font-semibold text-slate-900">
                          {link.label}
                        </span>
                        <svg
                          className={`h-4 w-4 text-slate-400 transition-all duration-300 ${
                            isExpanded ? 'rotate-90 text-orange-500' : ''
                          }`}
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l6 5-6 5" />
                        </svg>
                      </button>
                    ) : (
                      <Link
                        href={link.href}
                        onClick={closeMobileNav}
                        className={`group flex items-center rounded-xl px-3 py-3 transition-all duration-300 ${
                          isActive ? 'bg-orange-50 text-orange-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 transition-colors duration-300 ${
                            isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500'
                          }`}
                        >
                          {link.icon}
                        </span>
                        <span className="ml-3 text-[0.82rem] font-semibold text-slate-900">{link.label}</span>
                      </Link>
                    )}

                    {hasChildren && isExpanded ? (
                      <div className="ml-9 space-y-1">
                        {link.children!.map((child) => {
                          const isRootIntegration = child.href === '/integrations';
                          const childActive = isRootIntegration
                            ? normalizedPath === child.href
                            : normalizedPath === child.href || normalizedPath.startsWith(`${child.href}/`);
                          return (
                            <Link
                              key={`mobile-child-${child.href}`}
                              href={child.href}
                              onClick={closeMobileNav}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[0.82rem] transition ${
                                childActive
                                  ? 'bg-orange-50 text-orange-700 shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                  childActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {child.icon ?? <span className="h-4 w-4" />}
                              </span>
                              <span className="font-medium">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 px-3 py-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                    {`${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.trim() || '??'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[0.82rem] font-semibold text-slate-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <Link
                    href="/settings/profile"
                    onClick={closeMobileNav}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[0.82rem] text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                      <path
                        d="M4.5 10a5.5 5.5 0 0 1 10 0 5.5 5.5 0 0 1-10 0Zm5.5-3v3l2 1"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Settings</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      closeMobileNav();
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[0.82rem] text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                      <path d="M11 5v10M7 9l-2 2 2 2M11 10H4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Collapsed sidebar popup - rendered outside sidebar to avoid clipping */}
      {isSidebarCollapsed && collapsedPopupItem && popupPosition && !isMobileNavMounted && (
        <div className="hidden md:block">
          {/* Backdrop to close popup when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCollapsedPopupItem(null)}
          />
          {filteredNavigation.filter(link => link.children && link.href === collapsedPopupItem).map((link) => {
            const normalizedPath = pathname?.split('?')[0] || '/';

            return (
              <div
                key={link.href}
                className="fixed w-56 rounded-2xl border border-slate-200 bg-white shadow-lg z-50"
                style={{
                  left: `${popupPosition.left}px`,
                  top: `${popupPosition.top}px`
                }}
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="text-[0.82rem] font-semibold text-slate-900">{link.label}</div>
                </div>
                <div className="py-2">
                  {link.children!.map((child) => {
                    const isRootIntegration = child.href === '/integrations';
                    const childActive = isRootIntegration
                      ? normalizedPath === child.href
                      : normalizedPath === child.href || normalizedPath.startsWith(`${child.href}/`);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setCollapsedPopupItem(null)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-[0.82rem] transition ${
                          childActive
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full ${
                            childActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {child.icon ?? <span className="h-4 w-4" />}
                        </span>
                        <span className="font-medium">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white">
        {/* Top bar - connected to sidebar (no border between them) */}
        <header className="bg-white px-3 py-1 sm:px-4 lg:px-5 flex-shrink-0 sticky top-0 z-30">
          <div className="max-w-full flex min-h-[32px] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openMobileNav}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="h-10 md:hidden" />
            </div>

            {canViewAllTeams ? (
              <div className="relative">
                {isLoadingTeams ? (
                  <span className="text-sm text-slate-500">Loading teams…</span>
                ) : teams.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsTeamMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm hover:border-orange-400 focus:border-orange-500 focus:outline-none"
                    >
                      <span>Team scope:</span>
                      <span className="text-orange-600">
                        {selectedTeamIds.length === 0
                          ? 'All teams'
                          : selectedTeamIds
                              .map((id) => teams.find((t) => t.id === id)?.name || id)
                              .join(', ')}
                      </span>
                      <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path d="M6 8l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {isTeamMenuOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg z-50">
                        <div className="max-h-64 overflow-auto py-2">
                          <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTeamIds.length === 0}
                                onChange={() => handleTeamSelection('__all__')}
                              />
                              <span>All teams</span>
                            </label>
                          </div>
                          {teams.map((team) => (
                            <div
                              key={team.id}
                              className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTeamIds.includes(team.id)}
                                  onChange={() => handleTeamSelection(team.id)}
                                />
                                <span>{team.name}</span>
                              </label>
                              <button
                                className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                                onClick={() => handleOnlySelection(team.id)}
                              >
                                ONLY
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-red-500">No teams</span>
                )}
              </div>
            ) : (
              <div className="h-9" />
            )}
          </div>
        </header>

        {/* Main content area - rounded top-left corner for App Shell look */}
        <main className="flex-1 overflow-y-auto bg-slate-100 lg:rounded-tl-[1.75rem]">
          <div className="mx-auto min-h-full w-full max-w-[1560px] px-3 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-7 lg:px-5 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
      </div>
    </ToastProvider>
  );
}
