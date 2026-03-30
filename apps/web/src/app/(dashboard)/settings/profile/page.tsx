'use client';

import { PasswordForm } from './_components/password-form';
import { PersonalInfoForm } from './_components/personal-info-form';
import { ProfileSummaryCard } from './_components/profile-summary-card';
import { useProfileController } from './_hooks/use-profile-controller';
import { AlertBanner } from '@/components/ui/feedback';

export default function ProfilePage() {
  const {
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
  } = useProfileController();

  const roleText = roleNames.length > 0 ? roleNames.join(', ') : profile?.role || '—';
  const teamText = defaultTeamName || defaultTeamId || '—';

  return (
    <div className="space-y-6">
      {error && (
        <AlertBanner tone="error" message={error} />
      )}
      {successMessage && (
        <AlertBanner tone="success" message={successMessage} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ProfileSummaryCard
          initials={initials}
          displayName={displayName}
          email={email}
          tenantName={tenantName}
          employeeId={employeeId}
          fallbackEmployeeId={profile?.employeeId}
          roleText={roleText}
          teamText={teamText}
        />

        <PersonalInfoForm
          isLoading={isLoading}
          isSavingProfile={isSavingProfile}
          isProfileDirty={isProfileDirty}
          firstName={firstName}
          lastName={lastName}
          email={email}
          employeeId={employeeId}
          avatar={avatar}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onEmployeeIdChange={setEmployeeId}
          onAvatarChange={setAvatar}
          onSubmit={handleSaveProfile}
        />
      </div>

      <PasswordForm
        isLoading={isLoading}
        isSavingPassword={isSavingPassword}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleSavePassword}
      />
    </div>
  );
}
