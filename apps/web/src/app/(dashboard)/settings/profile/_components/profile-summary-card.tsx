'use client';

import { Card } from '@/components/ui/card';
import { User } from 'lucide-react';

interface ProfileSummaryCardProps {
  initials: string;
  displayName: string;
  email: string;
  tenantName: string | null;
  employeeId: string;
  fallbackEmployeeId: string | null | undefined;
  roleText: string;
  teamText: string;
}

export function ProfileSummaryCard({
  initials,
  displayName,
  email,
  tenantName,
  employeeId,
  fallbackEmployeeId,
  roleText,
  teamText,
}: ProfileSummaryCardProps) {
  return (
    <Card className="lg:col-span-1 border-slate-200 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25">
      <div className="-mx-6 -mt-6 mb-4 flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <User className="h-3.5 w-3.5 text-orange-500" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
          Profile Summary
        </h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-lg font-semibold text-white">
          {initials}
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">{displayName}</p>
          <p className="text-sm text-slate-600">{email}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Tenant</span>
          <span className="font-semibold text-slate-900">{tenantName || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Employee ID</span>
          <span className="font-semibold text-slate-900">
            {employeeId || fallbackEmployeeId || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Role</span>
          <span className="font-semibold text-slate-900">{roleText}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="mt-0.5">Teams</span>
          <span className="text-right font-semibold text-slate-900">{teamText}</span>
        </div>
      </div>
    </Card>
  );
}
