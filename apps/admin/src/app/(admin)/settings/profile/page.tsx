'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  readStoredAdminUser,
  storeAdminUser,
  type StoredAdminUser,
} from '@/lib/admin-session';
import { WmsCompactPanel } from '../../_components/wms-compact-panel';
import { WmsFormField } from '../../_components/wms-form-field';
import {
  SettingsBadge,
  SettingsNotice,
  SettingsPageFrame,
  SettingsStatCard,
} from '../_components/settings-panels';
import { updateWmsSettingsProfile } from '../_services/settings.service';
import type { UpdateWmsSettingsProfileInput } from '../_types/settings';
import { User, UserCircle, UserCog } from 'lucide-react';

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
        <div className="grid gap-4 xl:grid-cols-12 xl:items-stretch">
          <form onSubmit={handleSubmit} className="xl:col-span-9">
            <WmsCompactPanel title="Profile Information" icon={<UserCog className='panel-icon' />} className="h-full w-full">
              {message ? (
                <div
                  className={`mb-4 rounded-2xl border px-3 py-2.5 text-sm ${
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
                    className="input"
                  />
                </WmsFormField>

                <WmsFormField label="Last name">
                  <input
                    required
                    minLength={2}
                    value={form.lastName}
                    onChange={(event) => setField('lastName', event.target.value)}
                    className="input"
                  />
                </WmsFormField>

                <WmsFormField label="Employee ID">
                  <input
                    value={form.employeeId}
                    onChange={(event) => setField('employeeId', event.target.value)}
                    className="input"
                  />
                </WmsFormField>

                <WmsFormField label="Email">
                  <input
                    value={user.email ?? ''}
                    readOnly
                    className="input bg-[#f4f7f8] text-[#607586]"
                  />
                </WmsFormField>

                <div className="md:col-span-2">
                  <div className="rounded-xl border border-[#dce4ea] bg-[#fbfcfc] p-4">
                    <p className="panel-title">
                      Password
                    </p>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <WmsFormField label="Current password">
                        <input
                          type="password"
                          value={form.currentPassword}
                          onChange={(event) => setField('currentPassword', event.target.value)}
                          className="input"
                          autoComplete="current-password"
                        />
                      </WmsFormField>

                      <WmsFormField label="New password">
                        <input
                          type="password"
                          minLength={8}
                          value={form.newPassword}
                          onChange={(event) => setField('newPassword', event.target.value)}
                          className="input"
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
                  className="btn btn-md btn-primary"
                >
                  {isSaving ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </WmsCompactPanel>
          </form>

          <aside className="flex h-full flex-col gap-4 xl:col-span-3">
            <WmsCompactPanel title="Profile" icon={<UserCircle className='panel-icon' />} className="flex-1">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f7cf5f] text-xl font-semibold text-primary">
                {getInitials(user)}
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-primary">{displayName}</h2>
              <p className="mt-1 text-sm text-[#637786]">{user.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <SettingsBadge tone="success">{user.role ?? 'WMS'}</SettingsBadge>
                <SettingsBadge>Tenantless WMS</SettingsBadge>
              </div>
            </WmsCompactPanel>

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
