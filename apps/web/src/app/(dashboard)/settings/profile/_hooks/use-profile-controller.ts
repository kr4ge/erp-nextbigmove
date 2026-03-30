'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { profileService } from '../_services/profile.service';
import type { Profile } from '../_types/profile';
import {
  getProfileDisplayName,
  getProfileInitials,
  parseProfileError,
} from '../_utils/profile-formatters';

interface TenantLike {
  name?: string;
}

export function useProfileController() {
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

  const initials = useMemo(
    () => getProfileInitials(firstName, lastName),
    [firstName, lastName],
  );

  const displayName = useMemo(
    () =>
      getProfileDisplayName({
        firstName,
        lastName,
        email,
        profile,
        storedUser,
      }),
    [email, firstName, lastName, profile, storedUser],
  );

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

  const persistUserLocally = useCallback((user: Profile) => {
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
          const parsed = JSON.parse(tenantRaw) as TenantLike;
          if (parsed?.name) setTenantName(parsed.name);
        } catch {
          // ignore malformed tenant cache
        }
      }
    }
  }, []);

  useEffect(() => {
    let cachedUser: Profile | null = null;
    if (typeof window !== 'undefined') {
      const storedUserRaw = localStorage.getItem('user');
      if (storedUserRaw) {
        try {
          cachedUser = JSON.parse(storedUserRaw) as Profile;
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
          // ignore malformed user cache
        }
      }

      const storedTenantRaw = localStorage.getItem('tenant');
      if (storedTenantRaw) {
        try {
          const parsed = JSON.parse(storedTenantRaw) as TenantLike;
          setTenantName(parsed?.name || null);
        } catch {
          // ignore malformed tenant cache
        }
      }
    }

    const fetchProfile = async (fallbackUser?: Profile | null) => {
      setIsLoading(true);
      setError(null);
      try {
        const user = await profileService.fetchMe();
        if (!user) return;
        setProfile(user);
        setFirstName(user.firstName || fallbackUser?.firstName || '');
        setLastName(user.lastName || fallbackUser?.lastName || '');
        setEmail(user.email || '');
        setAvatar(user.avatar || fallbackUser?.avatar || '');
        setEmployeeId(user.employeeId || fallbackUser?.employeeId || '');
        if (user.tenant?.name) {
          setTenantName(user.tenant.name);
        }
      } catch (fetchError) {
        setError(parseProfileError(fetchError, 'Failed to load profile'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProfile(cachedUser);
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setRoleNames(await profileService.fetchRoleNames());
      } catch {
        setRoleNames([]);
      }
    };
    if (roleNames.length > 0) return;
    void fetchRoles();
  }, [roleNames.length]);

  useEffect(() => {
    const fetchDefaultTeam = async () => {
      if (!defaultTeamId) {
        setDefaultTeamName(null);
        return;
      }
      try {
        const teams = await profileService.fetchMyTeams();
        if (!teams.length) {
          setDefaultTeamName(null);
          return;
        }
        const matched = teams.find((team) => team.id === defaultTeamId);
        const fallback = teams[0];
        setDefaultTeamName(matched?.name || fallback?.name || null);
      } catch {
        setDefaultTeamName(null);
      }
    };

    if (!defaultTeamId) {
      setDefaultTeamName(null);
      return;
    }
    if (defaultTeamName) return;
    void fetchDefaultTeam();
  }, [defaultTeamId, defaultTeamName]);

  const handleSaveProfile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSavingProfile(true);
      setSuccessMessage(null);
      setError(null);

      try {
        if (!profile) {
          setError('Profile not loaded yet');
          return;
        }

        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        const trimmedAvatar = avatar.trim();
        const trimmedEmployeeId = employeeId.trim();

        const payload: Record<string, unknown> = {};
        if (trimmedFirst !== (profile.firstName || '')) payload.firstName = trimmedFirst;
        if (trimmedLast !== (profile.lastName || '')) payload.lastName = trimmedLast;
        if (trimmedAvatar !== (profile.avatar || '')) payload.avatar = trimmedAvatar || null;
        if (trimmedEmployeeId !== (profile.employeeId || '')) {
          payload.employeeId = trimmedEmployeeId || null;
        }

        if (Object.keys(payload).length === 0) {
          setSuccessMessage('No changes to save.');
          return;
        }

        const updatedUser = await profileService.updateProfile(payload);
        if (updatedUser) {
          persistUserLocally(updatedUser);
        }
        setSuccessMessage('Profile updated successfully.');
      } catch (saveError) {
        setError(parseProfileError(saveError, 'Failed to update profile'));
      } finally {
        setIsSavingProfile(false);
      }
    },
    [avatar, employeeId, firstName, lastName, persistUserLocally, profile],
  );

  const handleSavePassword = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
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
        const updatedUser = await profileService.updateProfile({
          currentPassword,
          newPassword,
        });
        if (updatedUser) {
          persistUserLocally(updatedUser);
        }
        setSuccessMessage('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (saveError) {
        setError(parseProfileError(saveError, 'Failed to update password'));
      } finally {
        setIsSavingPassword(false);
      }
    },
    [
      confirmPassword,
      currentPassword,
      newPassword,
      persistUserLocally,
    ],
  );

  return {
    profile,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    avatar,
    setAvatar,
    employeeId,
    setEmployeeId,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    isSavingProfile,
    isSavingPassword,
    error,
    successMessage,
    tenantName,
    defaultTeamName,
    roleNames,
    defaultTeamId,
    initials,
    displayName,
    isProfileDirty,
    handleSaveProfile,
    handleSavePassword,
  };
}
