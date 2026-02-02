'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';

type Profile = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  employeeId?: string | null;
  tenantId?: string | null;
  tenant?: { name?: string } | null;
  role?: string | null;
  defaultTeamId?: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [storedUser, setStoredUser] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [defaultTeamName, setDefaultTeamName] = useState<string | null>(null);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const defaultTeamId = useMemo(
    () => profile?.defaultTeamId || storedUser?.defaultTeamId || null,
    [profile?.defaultTeamId, storedUser?.defaultTeamId],
  );
  const defaultTeamFetchStarted = useRef(false);
  const roleFetchStarted = useRef(false);

  const initials = useMemo(() => {
    const source = `${firstName} ${lastName}`.trim();
    if (!source) return '??';
    return source
      .split(' ')
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  }, [firstName, lastName]);

  const displayName = useMemo(() => {
    const raw = `${firstName} ${lastName}`.trim();
    const fallback = `${profile?.firstName || storedUser?.firstName || ''} ${profile?.lastName || storedUser?.lastName || ''}`.trim();
    const name = raw || fallback || '';
    if (!name) return email || 'Your Name';
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [email, firstName, lastName, profile, storedUser]);

  const isProfileDirty = useMemo(() => {
    if (!profile) return false;
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedAvatar = avatar.trim();
    const trimmedEmployeeId = employeeId.trim();
    return (
      trimmedFirst !== (profile.firstName || '') ||
      trimmedLast !== (profile.lastName || '') ||
      trimmedAvatar !== (profile.avatar || '') ||
      trimmedEmployeeId !== (profile.employeeId || '')
    );
  }, [avatar, employeeId, firstName, lastName, profile]);

  useEffect(() => {
    // Prefill from local storage immediately
    let cachedUser: Profile | null = null;
    if (typeof window !== 'undefined') {
      const storedUserRaw = localStorage.getItem('user');
      if (storedUserRaw) {
        try {
          cachedUser = JSON.parse(storedUserRaw);
          if (cachedUser) {
            setStoredUser(cachedUser);
            setProfile((prev) => prev ?? cachedUser);
            setFirstName(cachedUser.firstName || '');
            setLastName(cachedUser.lastName || '');
            setEmail(cachedUser.email || '');
            setAvatar(cachedUser.avatar || '');
            setEmployeeId(cachedUser.employeeId || '');
          }
        } catch {
          // ignore
        }
      }
      const storedTenantRaw = localStorage.getItem('tenant');
      if (storedTenantRaw) {
        try {
          const storedTenant = JSON.parse(storedTenantRaw);
          setTenantName(storedTenant.name || null);
        } catch {
          // ignore
        }
      }
    }

    const fetchProfile = async (fallbackUser?: Profile | null) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.get('/auth/me');
        const user = res.data?.user || res.data;
        if (user) {
          setProfile(user);
          setFirstName(user.firstName || fallbackUser?.firstName || '');
          setLastName(user.lastName || fallbackUser?.lastName || '');
          setEmail(user.email || '');
          setAvatar(user.avatar || fallbackUser?.avatar || '');
          setEmployeeId(user.employeeId || fallbackUser?.employeeId || '');
          if (user.tenant?.name) {
            setTenantName(user.tenant.name);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile(cachedUser);
  }, []);

  // Fetch tenant-scoped roles from API
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await apiClient.get('/auth/my-role');
        const roles: any[] = res?.data?.roles || [];
        const names = roles.map((r) => r.name || r.key).filter(Boolean);
        setRoleNames(names);
      } catch {
        setRoleNames([]);
      } finally {
        roleFetchStarted.current = false;
      }
    };
    if (roleNames.length > 0) return;
    if (roleFetchStarted.current) return;
    roleFetchStarted.current = true;
    fetchRole();
  }, [roleNames.length]);

  // Load default team name (from user's defaultTeamId)
  useEffect(() => {
    const fetchDefaultTeam = async () => {
      try {
        const res = await apiClient.get('/teams/my-teams');
        const list = res?.data || [];
        if (!list.length) {
          setDefaultTeamName(null);
          return;
        }
        const match = defaultTeamId ? list.find((t: any) => t.id === defaultTeamId) : null;
        const chosen = match || list[0];
        setDefaultTeamName(chosen?.name || null);
      } catch {
        setDefaultTeamName(null);
      } finally {
        defaultTeamFetchStarted.current = false;
      }
    };
    if (!defaultTeamId) {
      setDefaultTeamName(null);
      defaultTeamFetchStarted.current = false;
      return;
    }
    if (defaultTeamName) return;
    if (defaultTeamFetchStarted.current) return;
    defaultTeamFetchStarted.current = true;
    fetchDefaultTeam();
  }, [defaultTeamId, defaultTeamName]);

  const persistUserLocally = (user: Profile) => {
    setProfile(user);
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setEmail(user.email || '');
    setAvatar(user.avatar || '');
    setEmployeeId(user.employeeId || '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
      setStoredUser(user);
      const tenantRaw = localStorage.getItem('tenant');
      if (tenantRaw) {
        try {
          const parsed = JSON.parse(tenantRaw);
          if (parsed?.name) setTenantName(parsed.name);
        } catch {
          // ignore
        }
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setSuccessMessage(null);
    setError(null);

    try {
      if (!profile) {
        setError('Profile not loaded yet');
        setIsSavingProfile(false);
        return;
      }

      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const trimmedAvatar = avatar.trim();
      const trimmedEmployeeId = employeeId.trim();

      const payload: Record<string, any> = {};
      if (trimmedFirst !== (profile.firstName || '')) payload.firstName = trimmedFirst;
      if (trimmedLast !== (profile.lastName || '')) payload.lastName = trimmedLast;
      if (trimmedAvatar !== (profile.avatar || '')) payload.avatar = trimmedAvatar || null;
      if (trimmedEmployeeId !== (profile.employeeId || '')) payload.employeeId = trimmedEmployeeId || null;

      if (Object.keys(payload).length === 0) {
        setSuccessMessage('No changes to save.');
        return;
      }

      const res = await apiClient.patch('/auth/profile', payload);
      const updatedUser = res.data?.user;
      if (updatedUser) {
        persistUserLocally(updatedUser);
      }
      setSuccessMessage('Profile updated successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    setSuccessMessage(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please provide your current password and the new password.');
      setIsSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      setIsSavingPassword(false);
      return;
    }

    try {
      const res = await apiClient.patch('/auth/profile', {
        currentPassword,
        newPassword,
      });
      const updatedUser = res.data?.user;
      if (updatedUser) {
        persistUserLocally(updatedUser);
      }
      setSuccessMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
              {initials}
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="text-sm text-slate-600">{email}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-2">
            <div className="flex items-center justify-between">
              <span>Tenant</span>
              <span className="font-semibold text-slate-900">
                {tenantName || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Employee ID</span>
              <span className="font-semibold text-slate-900">
                {employeeId || profile?.employeeId || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Role</span>
              <span className="font-semibold text-slate-900">
                {roleNames.length > 0 ? roleNames.join(', ') : profile?.role || '—'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="mt-0.5">Teams</span>
              <span className="font-semibold text-slate-900 text-right">
                {defaultTeamName || defaultTeamId || '—'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <form className="space-y-4" onSubmit={handleSaveProfile}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Personal info</h3>
                <p className="text-sm text-slate-500">These details are visible across your workspace.</p>
              </div>
              <Button type="submit" disabled={isLoading || isSavingProfile || !isProfileDirty}>
                {isSavingProfile ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="First name"
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                disabled={isLoading}
              />
              <FormInput
                label="Last name"
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                disabled={isLoading}
              />
            </div>
            <FormInput
              label="Email"
              name="email"
              value={email}
              disabled
            />
            <FormInput
              label="Employee ID"
              name="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP-1234"
              disabled={isLoading}
              helper="Use your internal employee code for reconciliation."
            />
            <FormInput
              label="Avatar URL"
              name="avatar"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/avatar.png"
              disabled={isLoading}
              helper="Optional. Paste an image URL to personalize your avatar."
            />
          </form>
        </Card>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={handleSavePassword}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Password</h3>
              <p className="text-sm text-slate-500">Update your password to keep your account secure.</p>
            </div>
            <Button type="submit" variant="secondary" disabled={isSavingPassword || isLoading}>
              {isSavingPassword ? 'Updating...' : 'Update password'}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FormInput
              label="Current password"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
            <FormInput
              label="New password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
            <FormInput
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
          </div>
        </form>
      </Card>
    </div>
  );
}
