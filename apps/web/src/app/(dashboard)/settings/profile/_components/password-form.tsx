'use client';

import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormInput } from '@/components/ui/form-input';

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
    <Card>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Password</h3>
            <p className="text-sm text-slate-500">
              Update your password to keep your account secure.
            </p>
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
            onChange={(event) => onCurrentPasswordChange(event.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            required
          />
          <FormInput
            label="New password"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            required
          />
          <FormInput
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            required
          />
        </div>
      </form>
    </Card>
  );
}
