import type { ChangeEvent } from 'react';
import type { WarehouseFormState } from '../_types/warehouses';

type WarehouseFormProps = {
  value: WarehouseFormState;
  title: string;
  submitLabel: string;
  isPending: boolean;
  canSubmit: boolean;
  onChange: (field: keyof WarehouseFormState, value: string | boolean) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

function handleInput(
  onChange: WarehouseFormProps['onChange'],
  field: keyof WarehouseFormState,
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
    onChange(field, event.target.checked);
    return;
  }

  onChange(field, event.target.value);
}

export function WarehouseForm({
  value,
  title,
  submitLabel,
  isPending,
  canSubmit,
  onChange,
  onSubmit,
  onCancel,
}: WarehouseFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-950">{title}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Name</span>
          <input
            value={value.name}
            onChange={(event) => handleInput(onChange, 'name', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Code</span>
          <input
            value={value.code}
            onChange={(event) => handleInput(onChange, 'code', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm">
        <span className="font-medium text-slate-700">Address</span>
        <input
          value={value.addressLine1}
          onChange={(event) => handleInput(onChange, 'addressLine1', event)}
          className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">City</span>
          <input
            value={value.city}
            onChange={(event) => handleInput(onChange, 'city', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Province</span>
          <input
            value={value.province}
            onChange={(event) => handleInput(onChange, 'province', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Status</span>
          <select
            value={value.status}
            onChange={(event) => handleInput(onChange, 'status', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </div>

      <label className="space-y-2 text-sm">
        <span className="font-medium text-slate-700">Notes</span>
        <textarea
          value={value.notes}
          onChange={(event) => handleInput(onChange, 'notes', event)}
          className="min-h-[96px] block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
        />
      </label>

      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={value.isDefault}
          onChange={(event) => handleInput(onChange, 'isDefault', event)}
          className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
        />
        Default warehouse
      </label>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isPending}
          className="inline-flex items-center rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
