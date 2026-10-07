'use client';

import { Megaphone, X } from 'lucide-react';
import { CreativeStorePublishingPanel } from '@/app/(dashboard)/creative-agent/video-registry/_components/creative-store-publishing-panel';

interface StoreMetaPublishingModalProps {
  isOpen: boolean;
  posStoreId: string;
  canEdit: boolean;
  onClose: () => void;
}

/**
 * Where this store launches on Meta, opened from Quick Actions. Same shell as
 * the Creative Targets modal; the panel owns loading, saving and its action row.
 */
export function StoreMetaPublishingModal({ isOpen, posStoreId, canEdit, onClose }: StoreMetaPublishingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <Megaphone className="h-4 w-4 text-blue-500" />
          <h4 className="text-sm font-semibold text-slate-800">Meta Publishing</h4>
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
          <CreativeStorePublishingPanel posStoreId={posStoreId} canEdit={canEdit} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
