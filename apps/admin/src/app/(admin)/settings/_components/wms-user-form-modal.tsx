'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { WmsFormField } from '../../_components/wms-form-field';
import { WmsModal } from '../../_components/wms-modal';
import type {
  CreateWmsSettingsUserInput,
  UpdateWmsSettingsUserInput,
  WmsSettingsUser,
  WmsSettingsUserOptions,
} from '../_types/settings';

type WmsUserFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  user: WmsSettingsUser | null;
  options: WmsSettingsUserOptions | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: CreateWmsSettingsUserInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateWmsSettingsUserInput) => Promise<void>;
};

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  roleId: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  employeeId: '',
  roleId: '',
  status: 'ACTIVE',
};

export function WmsUserFormModal({
  open,
  mode,
  user,
  options,
  isSubmitting,
  error,
  onClose,
  onCreate,
  onUpdate,
}: WmsUserFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isEdit && user) {
      setForm({
        email: user.email,
        password: '',
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        employeeId: user.employeeId ?? '',
        roleId: user.wmsRoles[0]?.role.id ?? '',
        status: user.status,
      });
      return;
    }

    setForm({
      ...EMPTY_FORM,
      roleId: getWmsRoles(options)[0]?.id ?? '',
    });
  }, [isEdit, open, options, user]);

  const wmsRoles = useMemo(() => getWmsRoles(options), [options]);

  useEffect(() => {
    if (!open || !form.roleId || wmsRoles.some((role) => role.id === form.roleId)) {
      return;
    }

    setForm((current) => ({
      ...current,
      roleId: wmsRoles[0]?.id ?? '',
    }));
  }, [form.roleId, open, wmsRoles]);

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (isEdit && user) {
      await onUpdate(user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        employeeId: form.employeeId.trim() || null,
        password: form.password.trim() || undefined,
        roleId: form.roleId,
        status: form.status,
      });
      return;
    }

    await onCreate({
      email: form.email.trim(),
      password: form.password,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      employeeId: form.employeeId.trim() || null,
      roleId: form.roleId,
      status: form.status,
    });
  };

  return (
    <WmsModal
      open={open}
      title={isEdit ? 'Edit WMS staff' : 'Create WMS staff'}
      description="WMS access is separate from ERP tenant user access."
      onClose={onClose}
      panelClassName="max-w-[720px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-[12px] border border-[#d7e0e7] bg-white px-4 text-[13px] font-semibold text-[#12384b] transition hover:bg-[#f8fafb]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="wms-user-form"
            disabled={isSubmitting || !form.roleId}
            className="inline-flex h-10 items-center rounded-[12px] bg-[#12384b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3040] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create staff'}
          </button>
        </div>
      }
    >
      <form id="wms-user-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <WmsFormField label="First name">
            <input
              required
              value={form.firstName}
              onChange={(event) => setField('firstName', event.target.value)}
              className="wms-input w-full rounded-[14px]"
            />
          </WmsFormField>

          <WmsFormField label="Last name">
            <input
              required
              value={form.lastName}
              onChange={(event) => setField('lastName', event.target.value)}
              className="wms-input w-full rounded-[14px]"
            />
          </WmsFormField>

          <WmsFormField label="Email">
            <input
              required
              disabled={isEdit}
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              className="wms-input w-full rounded-[14px] disabled:bg-[#f4f7f8] disabled:text-[#7b8e9c]"
            />
          </WmsFormField>

          <WmsFormField label={isEdit ? 'New password' : 'Password'} hint={isEdit ? 'Leave blank to keep current password.' : undefined}>
            <input
              required={!isEdit}
              type="password"
              minLength={8}
              value={form.password}
              onChange={(event) => setField('password', event.target.value)}
              className="wms-input w-full rounded-[14px]"
            />
          </WmsFormField>

          <WmsFormField label="WMS role" hint="Role permissions apply across WMS partner data.">
            <select
              required
              disabled={wmsRoles.length === 0}
              value={form.roleId}
              onChange={(event) => setField('roleId', event.target.value)}
              className="wms-input w-full rounded-[14px] disabled:bg-[#f4f7f8] disabled:text-[#7b8e9c]"
            >
              <option value="">Select role</option>
              {wmsRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} {role.isSystem ? '(System)' : '(Custom)'}
                </option>
              ))}
            </select>
          </WmsFormField>

          <WmsFormField label="Status">
            <select
              value={form.status}
              onChange={(event) => setField('status', event.target.value)}
              className="wms-input w-full rounded-[14px]"
            >
              {(options?.statuses ?? ['ACTIVE', 'INACTIVE', 'INVITED', 'SUSPENDED']).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </WmsFormField>

          <div className="sm:col-span-2">
            <WmsFormField label="Employee ID">
              <input
                value={form.employeeId}
                onChange={(event) => setField('employeeId', event.target.value)}
                className="wms-input w-full rounded-[14px]"
              />
            </WmsFormField>
          </div>
        </div>
      </form>
    </WmsModal>
  );
}

function getWmsRoles(options: WmsSettingsUserOptions | null) {
  if (!options) {
    return [];
  }

  return options.roles
    .sort((left, right) => {
      if (left.isSystem !== right.isSystem) {
        return left.isSystem ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
}
