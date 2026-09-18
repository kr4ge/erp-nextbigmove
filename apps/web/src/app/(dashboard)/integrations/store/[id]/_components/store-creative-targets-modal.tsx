'use client';

import { Target, X } from 'lucide-react';
import { CreativeStoreTargetsPanel } from '@/app/(dashboard)/creative-agent/video-registry/_components/creative-store-targets-panel';

interface StoreCreativeTargetsModalProps {
  isOpen: boolean;
  posStoreId: string;
  canEdit: boolean;
  onClose: () => void;
}

/**
 * The store's creative targets, opened from Quick Actions.
 *
 * Same shell as the Initial Offer modal. The form owns its loading, saving
 * and action row, and mounts only while open so every opening shows what is
 * actually stored.
 */
export function StoreCreativeTargetsModal({ isOpen, posStoreId, canEdit, onClose }: StoreCreativeTargetsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <Target className="h-4 w-4 text-emerald-500" />
          <h4 className="text-sm font-semibold text-slate-800">Creative Targets</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <CreativeStoreTargetsPanel posStoreId={posStoreId} canEdit={canEdit} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
