'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CalendarDays, ChevronDown, LogOut, Moon, Search, SunMedium } from 'lucide-react';
import type { StoredAdminUser } from '@/lib/admin-session';

type WmsTopbarProps = {
  user: StoredAdminUser;
  onLogout: () => void;
};

function getDisplayName(user: StoredAdminUser): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'Workspace User';
}

function getInitials(user: StoredAdminUser): string {
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase();
  return initials || getDisplayName(user).slice(0, 2).toUpperCase();
}

function IconButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d7e0e7] bg-white text-[#1d4b61] transition hover:border-[#c5d2dc] hover:bg-[#f8fafb]"
    >
      {children}
    </button>
  );
}

export function WmsTopbar({ user, onLogout }: WmsTopbarProps) {
  const displayName = getDisplayName(user);
  const initials = getInitials(user);
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
    <header className="wms-rail flex items-center border-b border-[#dbe4ea] bg-[#fbfaf3] px-[var(--wms-shell-pad-x)] [--wms-control-height:2.5rem] [--wms-control-font-size:0.78rem]">
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <label className="wms-pill-control flex w-full max-w-[360px] items-center gap-3 rounded-full border border-[#d9e3ea] bg-white px-4 text-[#5d7282] shadow-[0_14px_35px_-30px_rgba(18,56,75,0.55)]">
          <Search className="h-4.5 w-4.5 text-[#1d4b61]" />
          <input
            type="text"
            value=""
            readOnly
            aria-label="Search workspace"
            placeholder="Find inventory, orders or reports"
            className="w-full bg-transparent text-[length:var(--wms-control-font-size)] font-medium placeholder:text-[#6b7d8b] focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2.5 xl:flex-nowrap">
          <IconButton>
            <Bell className="h-4.5 w-4.5" />
          </IconButton>
          <IconButton>
            <CalendarDays className="h-4.5 w-4.5" />
          </IconButton>

          <div className="wms-pill-control flex items-center rounded-full border border-[#d7e0e7] bg-white p-1 shadow-[0_14px_35px_-30px_rgba(18,56,75,0.55)]">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7cf5f] text-[#1d4b61]"
            >
              <SunMedium className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#1d4b61]"
            >
              <Moon className="h-4.5 w-4.5" />
            </button>
          </div>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((current) => !current)}
              className="wms-pill-control flex items-center gap-3 rounded-full border border-[#d7e0e7] bg-white pl-3 pr-4 text-[#1d4b61] shadow-[0_14px_35px_-30px_rgba(18,56,75,0.55)]"
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
              <div className="absolute right-0 top-full z-20 mt-3 min-w-[220px] rounded-[22px] border border-[#dbe4ea] bg-white p-2 shadow-[0_28px_60px_-38px_rgba(18,56,75,0.48)]">
                <div className="rounded-[18px] px-3 py-3">
                  <p className="truncate text-sm font-semibold text-[#12384b]">{displayName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#8293a0]">
                    {user.role ?? 'Workspace'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-medium text-[#12384b] transition hover:bg-[#f6f8fa]"
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
