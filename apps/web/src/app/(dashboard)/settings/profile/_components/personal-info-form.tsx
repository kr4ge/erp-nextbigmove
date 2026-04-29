'use client';

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { User } from 'lucide-react';

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

const profileFormLabelClass =
  'text-xs font-semibold uppercase tracking-[0.16em] text-slate-500';
const profileFormInputClass =
  'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100';
const profileFormHelperClass = 'text-xs text-slate-500';
const profileFormReadOnlyClass = 'bg-slate-50 text-slate-700';

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
    <Card className="lg:col-span-2 panel panel-content">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="-mx-6 -mt-6 mb-4 panel-header">
          <User className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
            Personal Information
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-slate-500">These details are visible across your workspace.</p>
          <Button
            type="submit"
            variant='primary'
            disabled={isLoading || isSavingProfile || !isProfileDirty}
          >
            {isSavingProfile ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FormInput
            label="First name"
            name="firstName"
            value={firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            placeholder="Your first name"
            disabled={isLoading}
            labelClassName={profileFormLabelClass}
            className={profileFormInputClass}
            helperClassName={profileFormHelperClass}
          />
          <FormInput
            label="Last name"
            name="lastName"
            value={lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            placeholder="Your last name"
            disabled={isLoading}
            labelClassName={profileFormLabelClass}
            className={profileFormInputClass}
            helperClassName={profileFormHelperClass}
          />
        </div>
        <FormInput
          label="Email"
          name="email"
          value={email}
          disabled
          labelClassName={profileFormLabelClass}
          className={`${profileFormInputClass} ${profileFormReadOnlyClass}`}
          helperClassName={profileFormHelperClass}
        />
        <FormInput
          label="Employee ID"
          name="employeeId"
          value={employeeId}
          onChange={(event) => onEmployeeIdChange(event.target.value)}
          placeholder="EMP-1234"
          disabled={isLoading}
          helper="Use your internal employee code for reconciliation."
          labelClassName={profileFormLabelClass}
          className={profileFormInputClass}
          helperClassName={profileFormHelperClass}
        />
        <FormInput
          label="Avatar URL"
          name="avatar"
          value={avatar}
          onChange={(event) => onAvatarChange(event.target.value)}
          placeholder="https://example.com/avatar.png"
          disabled={isLoading}
          helper="Optional. Paste an image URL to personalize your avatar."
          labelClassName={profileFormLabelClass}
          className={profileFormInputClass}
          helperClassName={profileFormHelperClass}
        />
      </form>
    </Card>
  );
}
