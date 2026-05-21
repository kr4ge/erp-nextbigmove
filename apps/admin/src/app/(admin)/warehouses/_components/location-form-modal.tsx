'use client';

import { useEffect, useMemo, useState } from 'react';
import { WmsFormField } from '../../_components/wms-form-field';
import { WmsModal } from '../../_components/wms-modal';
import type {
  CreateWmsLocationInput,
  WmsLocationKind,
  WmsLocationTreeNode,
  WmsWarehouseDetail,
} from '../_types/warehouse';

type LocationFormModalProps = {
  open: boolean;
  warehouse: WmsWarehouseDetail | null;
  location: WmsLocationTreeNode | null;
  draft: Partial<CreateWmsLocationInput> | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateWmsLocationInput) => Promise<void>;
};

type LocationFormState = {
  parentId: string;
  kind: WmsLocationKind;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  capacity: string;
};

const MAX_SECTION_RACKS = 2;
const DEFAULT_RACK_BINS = 6;

const DEFAULT_STATE: LocationFormState = {
  parentId: '',
  kind: 'SECTION',
  code: '',
  name: '',
  description: '',
  isActive: true,
  sortOrder: 0,
  capacity: '',
};

function isStructuralKind(kind: WmsLocationKind) {
  return kind === 'SECTION' || kind === 'RACK' || kind === 'BIN';
}

function formatKindLabel(kind: WmsLocationKind) {
  if (kind === 'BIN') {
    return 'Slot';
  }

  return kind
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function findLocationNodeById(nodes: WmsLocationTreeNode[], id: string): WmsLocationTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    const nested = findLocationNodeById(node.children, id);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function sectionCodeToNumber(code: string): number | null {
  if (!/^[A-Z]+$/.test(code)) {
    return null;
  }
  return code.split('').reduce((sum, letter) => (sum * 26) + (letter.charCodeAt(0) - 64), 0);
}

function numberToSectionCode(value: number): string {
  let remainder = value;
  let result = '';
  while (remainder > 0) {
    const charCodeOffset = (remainder - 1) % 26;
    result = String.fromCharCode(65 + charCodeOffset) + result;
    remainder = Math.floor((remainder - 1) / 26);
  }
  return result;
}

function flattenLocations(
  nodes: WmsLocationTreeNode[],
  depth = 0,
): Array<{ id: string; kind: WmsLocationKind; label: string }> {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      kind: node.kind,
      label: `${'• '.repeat(depth)}${node.name} (${node.code})`,
    },
    ...flattenLocations(node.children, depth + 1),
  ]);
}

export function LocationFormModal({
  open,
  warehouse,
  location,
  draft,
  isSubmitting,
  onClose,
  onSubmit,
}: LocationFormModalProps) {
  const [state, setState] = useState<LocationFormState>(DEFAULT_STATE);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (location) {
      setState({
        parentId: location.parentId ?? '',
        kind: location.kind,
        code: location.code,
        name: location.name,
        description: location.description ?? '',
        isActive: location.isActive,
        sortOrder: location.sortOrder,
        capacity: location.capacity?.toString() ?? '',
      });
      return;
    }

    setState({
      ...DEFAULT_STATE,
      kind: draft?.kind ?? DEFAULT_STATE.kind,
      parentId: draft?.parentId ?? DEFAULT_STATE.parentId,
      code: draft?.code ?? DEFAULT_STATE.code,
      name: draft?.name ?? DEFAULT_STATE.name,
      capacity: draft?.kind === 'SECTION'
        ? String(MAX_SECTION_RACKS)
        : draft?.kind === 'RACK'
          ? String(DEFAULT_RACK_BINS)
          : draft?.kind === 'BIN'
            ? '1'
            : '',
    });
  }, [draft, open, location]);

  const parentOptions = useMemo(() => {
    if (!warehouse || location) {
      return [];
    }

    const allLocations = flattenLocations(warehouse.rootLocations);

    if (state.kind === 'RACK') {
      return allLocations.filter((entry) => entry.kind === 'SECTION');
    }

    if (state.kind === 'BIN') {
      return allLocations.filter((entry) => entry.kind === 'RACK');
    }

    return [];
  }, [location, state.kind, warehouse]);

  const isStructuralCreate = !location && isStructuralKind(state.kind);
  const needsParent = state.kind === 'RACK' || state.kind === 'BIN';
  const parentSelected = !needsParent || !!state.parentId;
  const hasValidBinCapacity =
    state.kind !== 'BIN'
    || (Number.isFinite(Number(state.capacity)) && Number(state.capacity) >= 1);
  const hasValidRackCapacity =
    state.kind !== 'RACK'
    || (
      Number.isFinite(Number(state.capacity))
      && Number(state.capacity) >= 1
      && Number(state.capacity) <= DEFAULT_RACK_BINS
    );
  const hasValidSectionCapacity =
    state.kind !== 'SECTION'
    || (
      Number.isFinite(Number(state.capacity))
      && Number(state.capacity) >= 1
      && Number(state.capacity) <= MAX_SECTION_RACKS
    );
  const rackCapacityError =
    state.kind === 'RACK' && !hasValidRackCapacity
      ? `Slots must be between 1 and ${DEFAULT_RACK_BINS}.`
      : '';
  const sectionCapacityError =
    state.kind === 'SECTION' && !hasValidSectionCapacity
      ? 'Maximum of 2 racks'
      : '';

  const autoCodePreview = useMemo(() => {
    if (!isStructuralCreate || !warehouse) {
      return '';
    }

    if (state.kind === 'SECTION') {
      const maxSectionNumber = warehouse.structuralLocations.reduce((highest, section) => {
        const value = sectionCodeToNumber(section.code);
        if (!value) {
          return highest;
        }
        return Math.max(highest, value);
      }, 0);
      return numberToSectionCode(maxSectionNumber + 1);
    }

    if (!state.parentId) {
      return '';
    }

    const parentNode = findLocationNodeById(warehouse.rootLocations, state.parentId);
    if (!parentNode) {
      return '';
    }

    if (state.kind === 'RACK') {
      const rackNumbers = parentNode.children.map((rack) => {
        const match = rack.code.match(new RegExp(`^${parentNode.code}(\\d+)$`));
        return match ? Number(match[1]) : 0;
      });
      const nextRackNumber = Math.max(0, ...rackNumbers) + 1;
      return `${parentNode.code}${nextRackNumber}`;
    }

    const binNumbers = parentNode.children.map((bin) => {
      const match = bin.code.match(new RegExp(`^${parentNode.code}-[BS](\\d+)$`));
      return match ? Number(match[1]) : 0;
    });
    const nextBinNumber = Math.max(0, ...binNumbers) + 1;
    return `${parentNode.code}-S${String(nextBinNumber).padStart(2, '0')}`;
  }, [isStructuralCreate, state.kind, state.parentId, warehouse]);

  const saveDisabled =
    isSubmitting ||
    !warehouse ||
    !parentSelected ||
    !hasValidRackCapacity ||
    !hasValidSectionCapacity ||
    !hasValidBinCapacity ||
    (!location && !isStructuralCreate && (!state.code.trim() || !state.name.trim())) ||
    (!!location && (!state.code.trim() || !state.name.trim()));

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="btn btn-md btn-outline"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={saveDisabled}
        onClick={async () => {
          if (!hasValidRackCapacity) {
            return;
          }

          const normalizedCapacity = state.capacity.trim() ? Number(state.capacity) : undefined;
          await onSubmit({
            parentId: !location && parentOptions.length > 0 && state.parentId ? state.parentId : undefined,
            kind: state.kind,
            code: location ? state.code : (isStructuralCreate ? undefined : state.code),
            name: location
              ? state.name
              : isStructuralCreate
                ? (state.name.trim() || undefined)
                : state.name,
            description: state.description || undefined,
            isActive: state.isActive,
            sortOrder: Number.isFinite(state.sortOrder) ? state.sortOrder : 0,
            capacity: normalizedCapacity,
          });
        }}
        className="btn btn-md btn-primary"
      >
        {isSubmitting ? 'Saving...' : location ? 'Save location' : 'Create location'}
      </button>
    </div>
  );

  return (
    <WmsModal
      open={open}
      onClose={onClose}
      title={location ? 'Edit location' : 'New location'}
      footer={footer}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <WmsFormField label="Kind">
          {location ? (
            <input value={formatKindLabel(state.kind)} className="input" readOnly />
          ) : (
            <select
              value={state.kind}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  kind: event.target.value as WmsLocationKind,
                  parentId: '',
                }))
              }
              className="input"
            >
              <optgroup label="Structural">
                <option value="SECTION">Section</option>
                <option value="RACK">Rack</option>
                <option value="BIN">Slot</option>
              </optgroup>
              <optgroup label="Operational">
                <option value="RECEIVING_STAGING">Receiving staging</option>
                <option value="PACKING">Packing</option>
                <option value="DISPATCH_STAGING">Dispatch staging</option>
                <option value="RTS">RTS</option>
                <option value="DAMAGE">Damage</option>
                <option value="QUARANTINE">Quarantine</option>
              </optgroup>
            </select>
          )}
        </WmsFormField>

        {!location ? (
          <WmsFormField label="Parent">
            <select
              value={state.parentId}
              onChange={(event) => setState((current) => ({ ...current, parentId: event.target.value }))}
              className="input"
              disabled={parentOptions.length === 0}
            >
              <option value="">{parentOptions.length === 0 ? 'Root location' : 'Select parent'}</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </WmsFormField>
        ) : (
          <div className="rounded-2xl border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">Hierarchy</p>
            <p className="mt-2 text-sm text-primary">
              Structural hierarchy is locked after creation to preserve serialized location traceability.
            </p>
          </div>
        )}

        {isStructuralCreate ? (
          <>
            {state.kind === 'SECTION' ? (
              <WmsFormField label="Section Name">
                <input
                  value={state.name}
                  onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
                  className="input"
                  placeholder="e.g. Electronics, Appliances"
                  required
                />
              </WmsFormField>
            ) : null}

            <div className={state.kind === 'SECTION' ? '' : 'md:col-span-2'}>
              <WmsFormField label="Auto code">
                <div className="input">
                  {parentSelected && autoCodePreview
                    ? state.kind === 'SECTION' && state.name.trim()
                      ? `${autoCodePreview} – ${state.name.trim()}`
                      : `${autoCodePreview}`
                    : needsParent
                      ? `Choose a parent ${state.kind === 'RACK' ? 'section' : 'rack'} to generate the next code.`
                      : 'Code will be generated automatically.'}
                </div>
              </WmsFormField>
            </div>
          </>
        ) : (
          <>
            <WmsFormField label="Code">
              <input
                value={state.code}
                onChange={(event) => setState((current) => ({ ...current, code: event.target.value }))}
                className="input"
                placeholder="PACK-01, RTS-A"
                readOnly={!!location && isStructuralKind(location.kind)}
              />
            </WmsFormField>

            <WmsFormField label="Name">
              <input
                value={state.name}
                onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
                className="input"
                placeholder="Packing Bay"
              />
            </WmsFormField>
          </>
        )}

        {state.kind === 'SECTION' ? (
          <WmsFormField label="Maximum Racks">
            <div className="space-y-2">
              <input
                type="number"
                min={1}
                max={MAX_SECTION_RACKS}
                value={state.capacity}
                onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
                aria-invalid={sectionCapacityError ? 'true' : 'false'}
                className="input"
                placeholder={String(MAX_SECTION_RACKS)}
              />
              {sectionCapacityError ? <p className="text-sm text-red-600">{sectionCapacityError}</p> : null}
            </div>
          </WmsFormField>
        ) : state.kind === 'RACK' ? (
          <WmsFormField
            label="Maximum Slots"
          >
            <div className="space-y-2">
              <input
                type="number"
                min={1}
                max={DEFAULT_RACK_BINS}
                value={state.capacity}
                onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
                aria-invalid={rackCapacityError ? 'true' : 'false'}
                className="input"
                placeholder={String(DEFAULT_RACK_BINS)}
              />
              {rackCapacityError ? <p className="text-sm text-red-600">{rackCapacityError}</p> : null}
            </div>
          </WmsFormField>
        ) : state.kind === 'BIN' ? (
          <WmsFormField label="Slot Capacity (Units)">
            <input
              type="number"
              min={1}
              value={state.capacity}
              onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
              className="input"
              placeholder="Required"
            />
          </WmsFormField>
        ) : (
          <WmsFormField label="Capacity">
            <input
              type="number"
              value={state.capacity}
              onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
              className="input"
              placeholder="Optional"
            />
          </WmsFormField>
        )}

        <WmsFormField label="Sort order">
          <input
            type="number"
            value={state.sortOrder}
            onChange={(event) =>
              setState((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))
            }
            className="input"
          />
        </WmsFormField>

        <div className="rounded-2xl border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 md:col-span-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">Active</p>
          <label className="mt-2 flex items-center gap-3 text-sm text-primary">
            <input
              type="checkbox"
              checked={state.isActive}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-[#c8d5de] text-primary"
            />
            Keep this location available for warehouse operations
          </label>
        </div>

        <div className="md:col-span-2">
          <WmsFormField label="Description">
            <textarea
              value={state.description}
              onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
              className="input"
              rows={3}
              placeholder="Optional warehouse note or routing hint"
            />
          </WmsFormField>
        </div>
      </div>
    </WmsModal>
  );
}
