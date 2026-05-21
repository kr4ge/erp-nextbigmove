'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readStoredAdminUser, readStoredPermissions, type StoredAdminUser } from '@/lib/admin-session';
import {
  hasAnyAdminPermission,
  WMS_ROLES_READ_PERMISSIONS,
  WMS_USERS_READ_PERMISSIONS,
} from '@/lib/wms-permissions';
import { User } from 'lucide-react';

type SettingsPageFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SettingsPageFrame({
  actions,
  children,
}: SettingsPageFrameProps) {
  return (
    <div className="space-y-6 p-[var(--wms-shell-pad-x)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SettingsTabs />
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {children}
    </div>
  );
}

function SettingsTabs() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    setUser(readStoredAdminUser());
    setPermissions(readStoredPermissions());
  }, []);

  const tabs = useMemo(() => {
    const role = user?.role;
    const items = [
      {
        href: '/settings/profile',
        label: 'Profile',
        visible: true,
      },
      {
        href: '/settings/users',
        label: 'Users',
        visible: hasAnyAdminPermission(role, permissions, WMS_USERS_READ_PERMISSIONS),
      },
      {
        href: '/settings/roles',
        label: 'Roles',
        visible: hasAnyAdminPermission(role, permissions, WMS_ROLES_READ_PERMISSIONS),
      },
    ];

    return items.filter((item) => item.visible);
  }, [permissions, user?.role]);

  return (
    <div className="overflow-x-auto md:flex-1">
      <nav className="flex min-w-max gap-6 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SettingsStatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'gold' | 'blue';
}) {
  const toneClass =
    tone === 'gold'
      ? 'border-[#f3df9f] bg-[#fff8de] text-[#8a6814]'
      : tone === 'blue'
        ? 'border-[#cfe3ee] bg-[#f1f8fb] text-primary'
        : 'border-[#dce4ea] bg-white text-primary';

  return (
    <div className={`card ${toneClass}`}>
      <p className="card-label">{label}</p>
      <p className="card-value">{value}</p>
    </div>
  );
}

export function SettingsNotice({
  title,
  message,
  tone = 'muted',
}: {
  title: string;
  message: string;
  tone?: 'muted' | 'danger';
}) {
  const className =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-[#dce4ea] bg-[#fbfcfc] text-[#637786]';

  return (
    <div className={`rounded-2xl border px-5 py-5 ${className}`}>
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center" aria-hidden="true">
          <User className='h-8 w-8 text-primary' />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-primary">{title}</p>
          <p className="text-sm leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function SettingsLinkCard({
  href,
  title,
  description,
  meta,
}: {
  href: string;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group rounded-[26px] border border-[#dce4ea] bg-white px-5 py-5 shadow-[0_18px_55px_-42px_rgba(18,56,75,0.4)] transition hover:-translate-y-0.5 hover:border-[#cbd8e0]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a894f]">{meta}</p>
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#637786]">{description}</p>
      <span className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-[#0f3040]">
        Open
      </span>
    </Link>
  );
}

export function SettingsBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-[#f2dc9b] bg-[#fff8df] text-[#806115]'
        : 'border-[#dce4ea] bg-[#fbfcfc] text-[#637786]';

  return (
    <span className={`pill ${toneClass}`}>
      {children}
    </span>
  );
}
