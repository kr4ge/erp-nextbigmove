'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { LockKeyhole, UserCircle2 } from 'lucide-react';
import { WmsPageHeader } from '../../_components/wms-page-header';
import { WmsSectionCard } from '../../_components/wms-section-card';
import { fetchProfile, updateProfile } from './_services/profile.service';

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.trim().toUpperCase() || 'WC';
}

export default function WmsSettingsProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['wms-settings-profile'],
    queryFn: fetchProfile,
  });

  const profile = profileQuery.data;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [avatar, setAvatar] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setEmployeeId(profile.employeeId || '');
    setAvatar(profile.avatar || '');
  }, [profile]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      if (newPassword && newPassword !== confirmPassword) {
        throw new Error('Password confirmation does not match.');
      }

      return updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        employeeId: employeeId.trim() || null,
        avatar: avatar.trim() || null,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      });
    },
    onSuccess: (updatedProfile) => {
      setMessage('Profile updated.');
      setError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      localStorage.setItem('user', JSON.stringify(updatedProfile));
    },
    onError: (mutationError: unknown) => {
      const nextError =
        mutationError instanceof Error ? mutationError.message : 'Unable to update profile.';
      setError(nextError);
      setMessage(null);
    },
  });

  const initials = useMemo(
    () => getInitials(firstName, lastName),
    [firstName, lastName],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    profileMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <WmsPageHeader
        title="Profile"
        description="Platform account for Warehouse Connex."
        eyebrow="Settings"
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <WmsSectionCard title="Account" icon={<UserCircle2 className="h-3.5 w-3.5" />}>
          {profileQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading profile...</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-700">
                  {initials}
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    {[firstName, lastName].filter(Boolean).join(' ') || profile?.email}
                  </p>
                  <p className="text-sm text-slate-500">{profile?.email || '—'}</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Access</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{profile?.role || 'SUPER_ADMIN'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employee ID</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{employeeId || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </WmsSectionCard>

        <form onSubmit={handleSubmit} className="space-y-6">
          <WmsSectionCard title="Personal" icon={<UserCircle2 className="h-3.5 w-3.5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Employee ID</span>
                <input
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Avatar URL</span>
                <input
                  value={avatar}
                  onChange={(event) => setAvatar(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>
          </WmsSectionCard>

          <WmsSectionCard title="Password" icon={<LockKeyhole className="h-3.5 w-3.5" />}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Current password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>
          </WmsSectionCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileMutation.isPending || profileQuery.isLoading}
              className="inline-flex items-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
