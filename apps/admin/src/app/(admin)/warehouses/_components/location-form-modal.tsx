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
      capacity: draft?.kind === 'SECTION' ? '12' : draft?.kind === 'RACK' ? '6' : draft?.kind === 'BIN' ? '1' : '',
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
      const match = bin.code.match(new RegExp(`^${parentNode.code}-B(\\d+)$`));
      return match ? Number(match[1]) : 0;
    });
    const nextBinNumber = Math.max(0, ...binNumbers) + 1;
    return `${parentNode.code}-B${String(nextBinNumber).padStart(2, '0')}`;
  }, [isStructuralCreate, state.kind, state.parentId, warehouse]);

  const saveDisabled =
    isSubmitting ||
    !warehouse ||
    !parentSelected ||
    !hasValidBinCapacity ||
    (!location && !isStructuralCreate && (!state.code.trim() || !state.name.trim())) ||
    (!!location && (!state.code.trim() || !state.name.trim()));

  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="wms-pill-control rounded-full border border-[#d7e0e7] bg-white px-4 font-medium text-[#1d4b61]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={saveDisabled}
        onClick={async () => {
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
        className="wms-pill-control rounded-full bg-[#12384b] px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
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
      description="Build structural slots for storage or create the operational zones the warehouse team works from."
      footer={footer}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <WmsFormField label="Kind">
          {location ? (
            <input value={formatKindLabel(state.kind)} className="wms-input w-full" readOnly />
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
              className="wms-select w-full"
            >
              <optgroup label="Structural">
                <option value="SECTION">Section</option>
                <option value="RACK">Rack</option>
                <option value="BIN">Bin</option>
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
              className="wms-select w-full"
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
          <div className="rounded-[24px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">Hierarchy</p>
            <p className="mt-2 text-sm text-[#12384b]">
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
                  className="wms-input w-full"
                  placeholder="e.g. Electronics, Appliances"
                />
              </WmsFormField>
            ) : null}

            <div className={`rounded-[24px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 ${state.kind === 'SECTION' ? '' : 'md:col-span-2'}`}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">
                Auto code
              </p>
              <p className="mt-2 text-sm text-[#12384b]">
                {parentSelected && autoCodePreview
                  ? state.kind === 'SECTION' && state.name.trim()
                    ? `${autoCodePreview} – ${state.name.trim()}`
                    : `${autoCodePreview}`
                  : needsParent
                    ? `Choose a parent ${state.kind === 'RACK' ? 'section' : 'rack'} to generate the next code.`
                    : 'Code will be generated automatically.'}
              </p>
            </div>
          </>
        ) : (
          <>
            <WmsFormField label="Code">
              <input
                value={state.code}
                onChange={(event) => setState((current) => ({ ...current, code: event.target.value }))}
                className="wms-input w-full"
                placeholder="PACK-01, RTS-A"
                readOnly={!!location && isStructuralKind(location.kind)}
              />
            </WmsFormField>

            <WmsFormField label="Name">
              <input
                value={state.name}
                onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
                className="wms-input w-full"
                placeholder="Packing Bay"
              />
            </WmsFormField>
          </>
        )}

        {state.kind === 'SECTION' && !location ? (
          <WmsFormField label="Maximum Racks">
            <input
              type="number"
              min={1}
              max={50}
              value={state.capacity}
              onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
              className="wms-input w-full"
              placeholder="2"
            />
          </WmsFormField>
        ) : state.kind === 'RACK' && !location ? (
          <WmsFormField label="Maximum Bins">
            <input
              type="number"
              min={1}
              max={100}
              value={state.capacity}
              onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
              className="wms-input w-full"
              placeholder="6"
            />
          </WmsFormField>
        ) : state.kind === 'BIN' ? (
          <WmsFormField label="Bin Capacity (Units)">
            <input
              type="number"
              min={1}
              value={state.capacity}
              onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
              className="wms-input w-full"
              placeholder="Required"
            />
          </WmsFormField>
        ) : (
          <WmsFormField label="Capacity">
            <input
              type="number"
              value={state.capacity}
              onChange={(event) => setState((current) => ({ ...current, capacity: event.target.value }))}
              className="wms-input w-full"
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
            className="wms-input w-full"
          />
        </WmsFormField>

        <div className="rounded-[24px] border border-[#dce4ea] bg-[#fbfcfc] px-4 py-3 md:col-span-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c8190]">Active</p>
          <label className="mt-2 flex items-center gap-3 text-sm text-[#12384b]">
            <input
              type="checkbox"
              checked={state.isActive}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-[#c8d5de] text-[#12384b]"
            />
            Keep this location available for warehouse operations
          </label>
        </div>

        <div className="md:col-span-2">
          <WmsFormField label="Description">
            <textarea
              value={state.description}
              onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
              className="wms-textarea w-full"
              rows={3}
              placeholder="Optional warehouse note or routing hint"
            />
          </WmsFormField>
        </div>
      </div>
    </WmsModal>
  );
}
