'use client';

interface MetaMultiplierModalProps {
  isOpen: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function MetaMultiplierModal({
  isOpen,
  value,
  onValueChange,
  onClose,
  onSave,
}: MetaMultiplierModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Add currency multiplier</h3>
        <p className="mb-4 text-sm text-slate-600">
          Apply a conversion multiplier to the selected non-PHP ad accounts.
        </p>
        <label className="mb-1 block text-sm font-medium text-slate-700">Multiplier</label>
        <input
          type="number"
          min="0"
          step="0.0001"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. 56.00"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
