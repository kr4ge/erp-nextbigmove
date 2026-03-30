'use client';

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';

interface PersonalInfoFormProps {
  isLoading: boolean;
  isSavingProfile: boolean;
  isProfileDirty: boolean;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  avatar: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmployeeIdChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function PersonalInfoForm({
  isLoading,
  isSavingProfile,
  isProfileDirty,
  firstName,
  lastName,
  email,
  employeeId,
  avatar,
  onFirstNameChange,
  onLastNameChange,
  onEmployeeIdChange,
  onAvatarChange,
  onSubmit,
}: PersonalInfoFormProps) {
  return (
    <Card className="lg:col-span-2">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Personal info</h3>
            <p className="text-sm text-slate-500">
              These details are visible across your workspace.
            </p>
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
            onChange={(event) => onFirstNameChange(event.target.value)}
            placeholder="Your first name"
            disabled={isLoading}
          />
          <FormInput
            label="Last name"
            name="lastName"
            value={lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            placeholder="Your last name"
            disabled={isLoading}
          />
        </div>
        <FormInput label="Email" name="email" value={email} disabled />
        <FormInput
          label="Employee ID"
          name="employeeId"
          value={employeeId}
          onChange={(event) => onEmployeeIdChange(event.target.value)}
          placeholder="EMP-1234"
          disabled={isLoading}
          helper="Use your internal employee code for reconciliation."
        />
        <FormInput
          label="Avatar URL"
          name="avatar"
          value={avatar}
          onChange={(event) => onAvatarChange(event.target.value)}
          placeholder="https://example.com/avatar.png"
          disabled={isLoading}
          helper="Optional. Paste an image URL to personalize your avatar."
        />
      </form>
    </Card>
  );
}
