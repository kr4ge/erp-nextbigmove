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
    <nav className="flex gap-2 overflow-x-auto rounded-[26px] border border-[#dce4ea] bg-white p-2 shadow-[0_18px_55px_-44px_rgba(18,56,75,0.36)]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
            className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold transition ${
              isActive
                ? 'bg-[#12384b] text-white shadow-[0_12px_28px_-20px_rgba(18,56,75,0.72)]'
                : 'text-[#4d6677] hover:bg-[#f6f8fa] hover:text-[#12384b]'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
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
        ? 'border-[#cfe3ee] bg-[#f1f8fb] text-[#12384b]'
        : 'border-[#dce4ea] bg-white text-[#12384b]';

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{value}</p>
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
    <div className={`rounded-[24px] border px-5 py-5 ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
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
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#12384b]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#637786]">{description}</p>
      <span className="mt-5 inline-flex rounded-full bg-[#12384b] px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-[#0f3040]">
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
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}
