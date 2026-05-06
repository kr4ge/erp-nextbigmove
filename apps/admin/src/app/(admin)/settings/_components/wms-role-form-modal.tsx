'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { WmsFormField } from '../../_components/wms-form-field';
import { WmsModal } from '../../_components/wms-modal';
import type {
  CreateWmsSettingsRoleInput,
  UpdateWmsSettingsRoleInput,
  WmsSettingsPermission,
  WmsSettingsRole,
  WmsSettingsRoleOptions,
} from '../_types/settings';

type WmsRoleFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  role: WmsSettingsRole | null;
  options: WmsSettingsRoleOptions | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: CreateWmsSettingsRoleInput) => Promise<void>;
  onUpdate: (id: string, input: UpdateWmsSettingsRoleInput) => Promise<void>;
};

type FormState = {
  name: string;
  key: string;
  description: string;
  permissionKeys: string[];
};

const EMPTY_FORM: FormState = {
  name: '',
  key: '',
  description: '',
  permissionKeys: [],
};

export function WmsRoleFormModal({
  open,
  mode,
  role,
  options,
  isSubmitting,
  error,
  onClose,
  onCreate,
  onUpdate,
}: WmsRoleFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keyTouched, setKeyTouched] = useState(false);
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isEdit && role) {
      setForm({
        name: role.name,
        key: role.key,
        description: role.description ?? '',
        permissionKeys: role.permissions.map((permission) => permission.key),
      });
      setKeyTouched(true);
      return;
    }

    setForm({
      ...EMPTY_FORM,
      permissionKeys: [],
    });
    setKeyTouched(false);
  }, [isEdit, open, options, role]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, WmsSettingsPermission[]>();
    for (const permission of options?.permissions ?? []) {
      const [, module = 'core'] = permission.key.split('.');
      const current = groups.get(module) ?? [];
      current.push(permission);
      groups.set(module, current);
    }

    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [options?.permissions]);

  const setField = (key: 'name' | 'key' | 'description', value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'name' && !keyTouched ? { key: buildRoleKey(value) } : {}),
    }));
  };

  const togglePermission = (permissionKey: string) => {
    setForm((current) => {
      const permissionKeys = current.permissionKeys.includes(permissionKey)
        ? current.permissionKeys.filter((key) => key !== permissionKey)
        : [...current.permissionKeys, permissionKey].sort();
      return { ...current, permissionKeys };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (isEdit && role) {
      await onUpdate(role.id, {
        name: form.name.trim(),
        key: form.key.trim(),
        description: form.description.trim() || null,
        permissionKeys: form.permissionKeys,
      });
      return;
    }

    await onCreate({
      name: form.name.trim(),
      key: form.key.trim(),
      description: form.description.trim() || null,
      permissionKeys: form.permissionKeys,
    });
  };

  return (
    <WmsModal
      open={open}
      title={isEdit ? 'Edit WMS role' : 'Create WMS role'}
      description="Only WMS permissions can be assigned to WMS roles."
      onClose={onClose}
      panelClassName="max-w-[860px]"
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
            form="wms-role-form"
            disabled={isSubmitting || form.permissionKeys.length === 0}
            className="inline-flex h-10 items-center rounded-[12px] bg-[#12384b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0f3040] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create role'}
          </button>
        </div>
      }
    >
      <form id="wms-role-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <WmsFormField label="Role name">
            <input
              required
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              className="wms-input w-full rounded-[14px]"
              placeholder="Picker Lead"
            />
          </WmsFormField>

          <WmsFormField label="Role key">
            <input
              required
              value={form.key}
              onChange={(event) => {
                setKeyTouched(true);
                setField('key', event.target.value);
              }}
              className="wms-input w-full rounded-[14px] font-mono"
              placeholder="WMS_PICKER_LEAD"
            />
          </WmsFormField>

          <div className="rounded-[14px] border border-[#dce4ea] bg-[#f8fafb] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8293a0]">Scope</p>
            <p className="mt-1 text-sm font-semibold text-[#12384b]">WMS workspace</p>
          </div>

          <div className="sm:col-span-2">
            <WmsFormField label="Description">
              <textarea
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                className="wms-input min-h-[84px] w-full rounded-[14px]"
                placeholder="What this WMS role is allowed to do."
              />
            </WmsFormField>
          </div>
        </div>

        <section className="rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">
                Permissions
              </p>
              <p className="mt-1 text-[12px] text-[#8397a4]">
                {form.permissionKeys.length} selected
              </p>
            </div>
          </div>

          <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {groupedPermissions.map(([module, permissions]) => (
              <div key={module} className="rounded-[14px] border border-[#dce4ea] bg-white p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8293a0]">
                  {module}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex cursor-pointer items-start gap-2 rounded-[12px] border border-[#e2e9ee] bg-[#fbfcfc] px-3 py-2.5 text-[12px] text-[#12384b] transition hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissionKeys.includes(permission.key)}
                        onChange={() => togglePermission(permission.key)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-mono font-semibold">{permission.key}</span>
                        {permission.description ? (
                          <span className="mt-0.5 block text-[#6f8290]">{permission.description}</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </form>
    </WmsModal>
  );
}

function buildRoleKey(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');

  return normalized ? `WMS_${normalized}` : '';
}
