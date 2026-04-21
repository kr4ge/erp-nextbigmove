'use client';

import { Button } from '@/components/ui/button';
import { DollarSign, X } from 'lucide-react';

interface StoreInitialOfferModalProps {
  isOpen: boolean;
  value: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function StoreInitialOfferModal({
  isOpen,
  value,
  isSaving,
  onChange,
  onClose,
  onSave,
}: StoreInitialOfferModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <h4 className="text-sm font-semibold text-slate-800">Set Initial Offer</h4>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Initial offer amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₱</span>
              <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm tabular-nums text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <p className="text-xs-tight text-slate-400">Leave blank to clear the initial offer.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={isSaving}
            disabled={isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

