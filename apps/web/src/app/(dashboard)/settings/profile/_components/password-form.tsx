'use client';

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';
import { KeyRound } from 'lucide-react';

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
  'text-xs font-semibold uppercase tracking-[0.16em] text-slate-500';
const passwordFormInputClass =
  'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100';
const passwordFormHelperClass = 'text-[11px] text-slate-500';

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
    <Card className="border-slate-200 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="-mx-6 -mt-6 mb-4 flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <KeyRound className="h-3.5 w-3.5 text-orange-500" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            Password
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-sm text-slate-500">Update your password to keep your account secure.</p>
          <Button
            type="submit"
            variant="secondary"
            disabled={isSavingPassword || isLoading}
            className="border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 focus:ring-orange-200"
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
    </Card>
  );
}
