'use client';

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { KeyRound } from 'lucide-react';
import { DashboardSection } from '../../../dashboard/_components/dashboard-section';

interface PasswordFormProps {
  isLoading: boolean;
  isSavingPassword: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const passwordFormLabelClass =
  'form-label';
const passwordFormInputClass =
  'rounded-2xl border border-slate-200 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 transition focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100';
const passwordFormHelperClass = 'text-xs text-slate-500';

export function PasswordForm({
  isLoading,
  isSavingPassword,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordFormProps) {
  return (
    <DashboardSection
      title="Password"
      icon={<KeyRound className="panel-icon" />}
      contentClassName="p-6"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-300">Update your password to keep your account secure.</p>
          <Button
            type="submit"
            variant="primary"
            disabled={isSavingPassword || isLoading}
            className='border-none'
          >
            {isSavingPassword ? 'Updating...' : 'Update password'}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FormInput
            label="Current password"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(event) => onCurrentPasswordChange(event.target.value)}
            placeholder="********"
            disabled={isLoading}
            required
            labelClassName={passwordFormLabelClass}
            className={passwordFormInputClass}
            helperClassName={passwordFormHelperClass}
          />
          <FormInput
            label="New password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            placeholder="********"
            disabled={isLoading}
            required
            labelClassName={passwordFormLabelClass}
            className={passwordFormInputClass}
            helperClassName={passwordFormHelperClass}
          />
          <FormInput
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="********"
            disabled={isLoading}
            required
            labelClassName={passwordFormLabelClass}
            className={passwordFormInputClass}
            helperClassName={passwordFormHelperClass}
          />
        </div>
      </form>
    </DashboardSection>
  );
}
