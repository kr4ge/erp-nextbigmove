'use client';

import { useEffect, useState } from 'react';
import { WmsModal } from '../../_components/wms-modal';
import type {
  UpdateWmsProductProfileInput,
  WmsProductProfileRecord,
  WmsProductsOverviewResponse,
  WmsProductProfileStatus,
} from '../_types/product';

type ProductProfileModalProps = {
  open: boolean;
  profile: WmsProductProfileRecord | null;
  locationOptions: WmsProductsOverviewResponse['locationOptions'];
  canEditProfile: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateWmsProductProfileInput) => Promise<void>;
};

type ProductProfileModalFormState = {
  status: WmsProductProfileStatus;
  isSerialized: boolean;
  preferredLocationId: string | null;
  isFragile: boolean;
  isStackable: boolean;
  keepDry: boolean;
  inhouseUnitCost: string;
  supplierUnitCost: string;
  notes: string;
};

type LocationOption = {
  id: string;
  label: string;
  kind: 'SECTION' | 'RACK' | 'BIN';
};

const statusOptions: Array<{ value: WmsProductProfileStatus; label: string }> = [
  { value: 'DEFAULT', label: 'Default' },
  { value: 'READY', label: 'Ready' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function toInputCost(value: string | null | undefined) {
  return value ?? '';
}

function toOptionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function ProductProfileModal({
  open,
  profile,
  locationOptions,
  canEditProfile,
  isSaving,
  onClose,
  onSubmit,
}: ProductProfileModalProps) {
  const sectionLocationOptions = locationOptions.filter((option) => option.kind === 'SECTION') as LocationOption[];

  const [formState, setFormState] = useState<ProductProfileModalFormState>({
    status: profile?.status ?? 'DEFAULT',
    isSerialized: profile?.isSerialized ?? true,
    preferredLocationId: profile?.preferredLocation?.id ?? null,
    isFragile: profile?.handling.isFragile ?? false,
    isStackable: profile?.handling.isStackable ?? true,
    keepDry: profile?.handling.keepDry ?? false,
    inhouseUnitCost: toInputCost(profile?.inhouseUnitCost),
    supplierUnitCost: toInputCost(profile?.supplierUnitCost),
    notes: profile?.notes ?? '',
  });

  useEffect(() => {
    setFormState({
      status: profile?.status ?? 'DEFAULT',
      isSerialized: profile?.isSerialized ?? true,
      preferredLocationId: profile?.preferredLocation?.id ?? null,
      isFragile: profile?.handling.isFragile ?? false,
      isStackable: profile?.handling.isStackable ?? true,
      keepDry: profile?.handling.keepDry ?? false,
      inhouseUnitCost: toInputCost(profile?.inhouseUnitCost),
      supplierUnitCost: toInputCost(profile?.supplierUnitCost),
      notes: profile?.notes ?? '',
    });
  }, [profile]);

  if (!open || !profile) {
    return null;
  }

  const inputsDisabled = isSaving || !canEditProfile;

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="wms-pill-control inline-flex items-center rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#325368]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={inputsDisabled}
        onClick={async () => {
          await onSubmit({
            ...formState,
            inhouseUnitCost: toOptionalNumber(formState.inhouseUnitCost),
            supplierUnitCost: toOptionalNumber(formState.supplierUnitCost),
            notes: formState.notes?.trim() ? formState.notes.trim() : null,
          });
        }}
        className="wms-pill-control inline-flex items-center rounded-full bg-[#12384b] px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!canEditProfile ? 'Edit permission required' : isSaving ? 'Saving' : 'Save profile'}
      </button>
    </div>
  );

  return (
    <WmsModal
      open={open}
      title={profile.name}
      description={`${profile.store.name} · ${profile.variationDisplayId ?? 'No variation ID'}`}
      onClose={onClose}
      footer={footer}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Status</span>
              <select
                value={formState.status}
                disabled={inputsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as WmsProductProfileStatus,
                  }))
                }
                className="h-11 w-full rounded-[18px] border border-[#d7e0e7] bg-white px-4 text-sm text-[#12384b] outline-none transition focus:border-[#a9c1ce]"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Serialized</span>
              <select
                value={formState.isSerialized ? 'true' : 'false'}
                disabled={inputsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isSerialized: event.target.value === 'true',
                  }))
                }
                className="h-11 w-full rounded-[18px] border border-[#d7e0e7] bg-white px-4 text-sm text-[#12384b] outline-none transition focus:border-[#a9c1ce]"
              >
                <option value="true">Serialized</option>
                <option value="false">Non-serialized</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Inhouse COGS</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={formState.inhouseUnitCost}
                disabled={inputsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    inhouseUnitCost: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-[18px] border border-[#d7e0e7] bg-white px-4 text-sm text-[#12384b] outline-none transition focus:border-[#a9c1ce]"
                placeholder="0.00"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Supplier COGS</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={formState.supplierUnitCost}
                disabled={inputsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    supplierUnitCost: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-[18px] border border-[#d7e0e7] bg-white px-4 text-sm text-[#12384b] outline-none transition focus:border-[#a9c1ce]"
                placeholder="0.00"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-1">
            <label className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Section Assignment</span>
              <select
                value={formState.preferredLocationId ?? ''}
                disabled={inputsDisabled}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    preferredLocationId: event.target.value || null,
                  }))
                }
                className="h-11 w-full rounded-[18px] border border-[#d7e0e7] bg-white px-4 text-sm text-[#12384b] outline-none transition focus:border-[#a9c1ce]"
              >
                <option value="">Not assigned</option>
                {sectionLocationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Handling</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['isFragile', 'Fragile'],
                ['isStackable', 'Stackable'],
                ['keepDry', 'Keep dry'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-[18px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 text-sm font-medium text-[#12384b]"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(formState[key as keyof ProductProfileModalFormState])}
                    disabled={inputsDisabled}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[#c5d5df] text-[#12384b]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Notes</span>
            <textarea
              value={formState.notes ?? ''}
              disabled={inputsDisabled}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={5}
              className="w-full rounded-[22px] border border-[#d7e0e7] bg-white px-4 py-3 text-sm leading-6 text-[#12384b] outline-none transition focus:border-[#a9c1ce]"
              placeholder="Storage rule notes, handling exceptions, or receiving guidance"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div className="wms-card border border-[#dce4ea] bg-[#fbfcfc]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Source</p>
            <div className="mt-3 space-y-3 text-sm text-[#4f6777]">
              <div>
                <p className="font-semibold text-[#12384b]">Variation ID</p>
                <p>{profile.variationDisplayId ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-[#12384b]">Product ID</p>
                <p>{profile.productCustomId ?? '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-[#12384b]">POS warehouse</p>
                <p>{profile.posWarehouse?.name ?? 'Store-level only'}</p>
              </div>
              <div>
                <p className="font-semibold text-[#12384b]">Inhouse COGS</p>
                <p>{profile.inhouseUnitCost ?? 'Not set'}</p>
              </div>
              <div>
                <p className="font-semibold text-[#12384b]">Supplier COGS</p>
                <p>{profile.supplierUnitCost ?? 'Not set'}</p>
              </div>
            </div>
          </div>

          <div className="wms-card border border-[#dce4ea] bg-[#fbfcfc]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8193a0]">Current rules</p>
            <div className="mt-3 space-y-3 text-sm text-[#4f6777]">
              <div>
                <p className="font-semibold text-[#12384b]">Section assignment</p>
                <p>{profile.preferredLocation?.label ?? 'Not assigned'}</p>
              </div>
              <div>
                <p className="font-semibold text-[#12384b]">Updated</p>
                <p>{new Date(profile.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WmsModal>
  );
}
