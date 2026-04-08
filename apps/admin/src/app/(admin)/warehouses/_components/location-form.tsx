import type { ChangeEvent } from 'react';
import type { LocationFormState, WmsLocation } from '../_types/warehouses';

type LocationFormProps = {
  value: LocationFormState;
  title: string;
  submitLabel: string;
  isPending: boolean;
  canSubmit: boolean;
  parentOptions: WmsLocation[];
  onChange: (field: keyof LocationFormState, value: string | boolean) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

function handleInput(
  onChange: LocationFormProps['onChange'],
  field: keyof LocationFormState,
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
) {
  if (event.target instanceof HTMLInputElement && event.target.type === 'checkbox') {
    onChange(field, event.target.checked);
    return;
  }

  onChange(field, event.target.value);
}

export function LocationForm({
  value,
  title,
  submitLabel,
  isPending,
  canSubmit,
  parentOptions,
  onChange,
  onSubmit,
  onCancel,
}: LocationFormProps) {
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Type</span>
          <select
            value={value.type}
            onChange={(event) => handleInput(onChange, 'type', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          >
            <option value="RECEIVING">Receiving</option>
            <option value="STORAGE">Storage</option>
            <option value="PICKING">Picking</option>
            <option value="PACKING">Packing</option>
            <option value="STAGING">Staging</option>
            <option value="RETURNS">Returns</option>
            <option value="DAMAGE">Damage</option>
            <option value="QUARANTINE">Quarantine</option>
            <option value="DISPATCH">Dispatch</option>
          </select>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Parent</span>
          <select
            value={value.parentId}
            onChange={(event) => handleInput(onChange, 'parentId', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          >
            <option value="">No parent</option>
            {parentOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} · {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Sort</span>
          <input
            type="number"
            min={0}
            value={value.sortOrder}
            onChange={(event) => handleInput(onChange, 'sortOrder', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Barcode</span>
          <input
            value={value.barcode}
            onChange={(event) => handleInput(onChange, 'barcode', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
          <p className="text-xs text-slate-500">
            Leave blank to auto-generate a scan-ready location label.
          </p>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Capacity</span>
          <input
            type="number"
            min={0}
            value={value.capacityUnits}
            onChange={(event) => handleInput(onChange, 'capacityUnits', event)}
            className="block w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <textarea
          value={value.description}
          onChange={(event) => handleInput(onChange, 'description', event)}
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
        Default location
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
