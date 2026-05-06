'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  readStoredAdminUser,
  storeAdminUser,
  type StoredAdminUser,
} from '@/lib/admin-session';
import { WmsFormField } from '../../_components/wms-form-field';
import {
  SettingsBadge,
  SettingsNotice,
  SettingsPageFrame,
  SettingsStatCard,
} from '../_components/settings-panels';
import { updateWmsSettingsProfile } from '../_services/settings.service';
import type { UpdateWmsSettingsProfileInput } from '../_types/settings';

type ProfileFormState = {
  firstName: string;
  lastName: string;
  employeeId: string;
  currentPassword: string;
  newPassword: string;
};

const EMPTY_FORM: ProfileFormState = {
  firstName: '',
  lastName: '',
  employeeId: '',
  currentPassword: '',
  newPassword: '',
};

export default function SettingsProfilePage() {
  const [user, setUser] = useState<StoredAdminUser | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    const storedUser = readStoredAdminUser();
    setUser(storedUser);
    setForm({
      ...EMPTY_FORM,
      firstName: storedUser?.firstName ?? '',
      lastName: storedUser?.lastName ?? '',
      employeeId: storedUser?.employeeId ?? '',
    });
    setHasHydrated(true);
  }, []);

  const setField = (key: keyof ProfileFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !user) {
      return;
    }

    if (form.newPassword && !form.currentPassword) {
      setMessage({ tone: 'danger', text: 'Current password is required to change your password.' });
      return;
    }

    const input: UpdateWmsSettingsProfileInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      employeeId: form.employeeId.trim() || null,
      ...(form.newPassword
        ? {
            currentPassword: form.currentPassword,
            newPassword: form.newPassword,
          }
        : {}),
    };

    setIsSaving(true);
    setMessage(null);

    try {
      const updatedUser = await updateWmsSettingsProfile(input);
      const nextUser = {
        ...user,
        ...updatedUser,
        id: updatedUser.id ?? updatedUser.userId ?? user.id ?? user.userId,
      };

      storeAdminUser(nextUser);
      setUser(nextUser);
      setForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
      }));
      setMessage({ tone: 'success', text: 'Profile updated.' });
    } catch (error: unknown) {
      setMessage({ tone: 'danger', text: getErrorMessage(error, 'Unable to update profile.') });
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'WMS User';

  return (
    <SettingsPageFrame
      eyebrow="WMS Settings"
      title="Profile"
      description="Manage your WMS workspace identity and password."
    >
      {!hasHydrated ? (
        <SettingsNotice title="Loading profile" message="Reading your current WMS session." />
      ) : !user ? (
        <SettingsNotice tone="danger" title="Profile unavailable" message="Sign in again to manage your profile." />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-[#dce4ea] bg-white px-5 py-5 shadow-[0_24px_70px_-50px_rgba(18,56,75,0.45)] xl:col-span-9"
          >
            {message ? (
              <div
                className={`mb-4 rounded-[16px] border px-3 py-2.5 text-sm ${
                  message.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <WmsFormField label="First name">
                <input
                  required
                  minLength={2}
                  value={form.firstName}
                  onChange={(event) => setField('firstName', event.target.value)}
                  className="wms-input w-full rounded-[14px]"
                />
              </WmsFormField>

              <WmsFormField label="Last name">
                <input
                  required
                  minLength={2}
                  value={form.lastName}
                  onChange={(event) => setField('lastName', event.target.value)}
                  className="wms-input w-full rounded-[14px]"
                />
              </WmsFormField>

              <WmsFormField label="Employee ID">
                <input
                  value={form.employeeId}
                  onChange={(event) => setField('employeeId', event.target.value)}
                  className="wms-input w-full rounded-[14px]"
                />
              </WmsFormField>

              <WmsFormField label="Email">
                <input
                  value={user.email ?? ''}
                  readOnly
                  className="wms-input w-full rounded-[14px] bg-[#f4f7f8] text-[#607586]"
                />
              </WmsFormField>

              <div className="md:col-span-2">
                <div className="rounded-[20px] border border-[#dce4ea] bg-[#fbfcfc] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8293a0]">
                    Password
                  </p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <WmsFormField label="Current password">
                      <input
                        type="password"
                        value={form.currentPassword}
                        onChange={(event) => setField('currentPassword', event.target.value)}
                        className="wms-input w-full rounded-[14px]"
                        autoComplete="current-password"
                      />
                    </WmsFormField>

                    <WmsFormField label="New password">
                      <input
                        type="password"
                        minLength={8}
                        value={form.newPassword}
                        onChange={(event) => setField('newPassword', event.target.value)}
                        className="wms-input w-full rounded-[14px]"
                        autoComplete="new-password"
                      />
                    </WmsFormField>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center rounded-full bg-[#12384b] px-5 text-[13px] font-semibold text-white transition hover:bg-[#0f3040] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>

          <aside className="space-y-4 xl:col-span-3">
            <div className="rounded-[28px] border border-[#dce4ea] bg-white px-5 py-5 shadow-[0_24px_70px_-50px_rgba(18,56,75,0.45)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f7cf5f] text-xl font-semibold text-[#12384b]">
                {getInitials(user)}
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#12384b]">{displayName}</h2>
              <p className="mt-1 text-sm text-[#637786]">{user.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <SettingsBadge tone="success">{user.role ?? 'WMS'}</SettingsBadge>
                <SettingsBadge>Tenantless WMS</SettingsBadge>
              </div>
            </div>

            <div className="grid gap-3">
              <SettingsStatCard label="Workspace" value="WMS" tone="blue" />
              <SettingsStatCard label="Account Scope" value="Staff" tone="gold" />
            </div>
          </aside>
        </div>
      )}
    </SettingsPageFrame>
  );
}

function getInitials(user: StoredAdminUser) {
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase();
  return initials || (user.email ?? 'WM').slice(0, 2).toUpperCase();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && typeof (error as { response?: unknown }).response === 'object'
    && typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }

  return fallback;
}
