'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Settings } from 'lucide-react';
import type { StoredAdminUser } from '@/lib/admin-session';
import { WMS_NAV_ITEMS } from '@/lib/wms-access';

type WmsTopbarProps = {
  user: StoredAdminUser;
  permissions: string[];
  onLogout: () => void;
  onOpenSidebar: () => void;
};

function getDisplayName(user: StoredAdminUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'Workspace User';
}

function getInitials(user: StoredAdminUser): string {
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase();
  return initials || getDisplayName(user).slice(0, 2).toUpperCase();
}

function getCurrentSectionName(pathname: string): string {
  for (const item of WMS_NAV_ITEMS) {
    if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) {
      return item.label;
    }

    for (const child of item.children ?? []) {
      if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
        return child.label;
      }
    }
  }

  return 'Workspace';
}

export function WmsTopbar({ user, onLogout, onOpenSidebar }: WmsTopbarProps) {
  const pathname = usePathname();
  const displayName = getDisplayName(user);
  const initials = getInitials(user);
  const sectionName = getCurrentSectionName(pathname);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <header className="min-h-[64px] flex items-center border-b border-[#dbe4ea] bg-[#fbfaf3] px-[var(--wms-shell-pad-x)] [--wms-control-height:2.5rem] [--wms-control-font-size:0.78rem]">
      <div className="flex w-full gap-3 items-center justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d7e0e7] bg-white text-primary transition hover:border-[#c6d4dd] hover:bg-[#f7fafb] lg:hidden"
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="hidden text-2xl truncate font-semibold tracking-tight text-primary sm:text-3xl lg:block">{sectionName}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 xl:flex-nowrap px-3 py-2 rounded-2xl transition duration-300 hover:bg-[#e6e4e1]">
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((current) => !current)}
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7cf5f] text-sm font-semibold">
                {initials}
              </div>
              <span className="max-w-[138px] truncate text-[length:var(--wms-control-font-size)] font-medium">
                {displayName}
              </span>
              <ChevronDown className="h-4 w-4 text-[#4f6777]" />
            </button>

            {isProfileOpen ? (
              <div className="absolute -right-3 top-full z-20 mt-3 min-w-[220px] rounded-2xl border border-[#dbe4ea] bg-white p-2 shadow-[0_28px_60px_-38px_rgba(18,56,75,0.48)]">
                <div className="rounded-[18px] px-3 py-3">
                  <p className="truncate text-sm font-semibold text-primary">{displayName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#8293a0]">
                    {user.role ?? 'Workspace'}
                  </p>
                </div>

                <Link
                  href="/settings/profile"
                  prefetch={false}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-medium text-primary transition hover:bg-[#f6f8fa]"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-medium text-primary transition hover:bg-[#f6f8fa]"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
