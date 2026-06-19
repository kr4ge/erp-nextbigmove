'use client';

import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { WmsInventoryUnitRecord } from '../_types/inventory';
import {
  formatInventoryStatusLabel,
  getInventoryStatusClassName,
} from '../_utils/inventory-status-presenters';

type InventoryUnitsTableProps = {
  units: WmsInventoryUnitRecord[];
  isLoading: boolean;
  tenantReady: boolean;
  selectedUnitIds: string[];
  canSelectUnits: boolean;
  onToggleUnitSelection: (unitId: string) => void;
  onToggleVisibleUnitSelection: () => void;
  onViewUnit: (unit: WmsInventoryUnitRecord) => void;
};

export function InventoryUnitsTable({
  units,
  isLoading,
  tenantReady,
  selectedUnitIds,
  canSelectUnits,
  onToggleUnitSelection,
  onToggleVisibleUnitSelection,
  onViewUnit,
}: InventoryUnitsTableProps) {
  const selectedUnitIdSet = new Set(selectedUnitIds);
  const visibleSelectionCount = units.filter((unit) => selectedUnitIdSet.has(unit.id)).length;
  const allVisibleSelected = units.length > 0 && visibleSelectionCount === units.length;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-[#eaf0f4] text-left">
            <HeaderCell>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={!canSelectUnits || units.length === 0}
                onChange={onToggleVisibleUnitSelection}
                className="h-4 w-4 rounded border-[#cbd8e1] text-primary focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Select visible units"
              />
            </HeaderCell>
            <HeaderCell>Unit</HeaderCell>
            <HeaderCell>Variation</HeaderCell>
            <HeaderCell>Product</HeaderCell>
            <HeaderCell>Store</HeaderCell>
            <HeaderCell>Warehouse</HeaderCell>
            <HeaderCell>Location</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell align="right">Action</HeaderCell>
          </tr>
        </thead>

        <tbody className="bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={9} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                Loading units…
              </td>
            </tr>
          ) : !tenantReady ? (
            <tr>
              <td colSpan={9} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                No tenant scope is active for inventory.
              </td>
            </tr>
          ) : units.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                No units yet. Receiving will create serialized stock here.
              </td>
            </tr>
          ) : (
            units.map((unit) => (
              <tr key={unit.id} className="border-b border-[#edf2f6] text-[13px] text-primary">
                <BodyCell>
                  <input
                    type="checkbox"
                    checked={selectedUnitIdSet.has(unit.id)}
                    disabled={!canSelectUnits}
                    onChange={() => onToggleUnitSelection(unit.id)}
                    className="h-4 w-4 rounded border-[#cbd8e1] text-primary focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Select ${unit.code}`}
                  />
                </BodyCell>

                <BodyCell className="font-semibold text-primary">
                  <div className="truncate">{unit.code}</div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-primary">
                      {unit.variationDisplayId ?? '—'}
                    </div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-primary">{unit.name}</div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">{unit.productId}</div>
                  </div>
                </BodyCell>

                <BodyCell>{unit.store.name}</BodyCell>

                <BodyCell>
                  <div className="truncate font-medium text-primary">{unit.warehouse.name}</div>
                </BodyCell>

                <BodyCell>
                  {unit.currentLocation ? (
                    <div className="truncate font-medium text-primary">{unit.currentLocation.code}</div>
                  ) : (
                    <span className="text-[#8aa0ae]">Not assigned</span>
                  )}
                </BodyCell>

                <BodyCell>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getInventoryStatusClassName(unit.status)}`}>
                    {formatInventoryStatusLabel(unit.status)}
                  </span>
                </BodyCell>

                <BodyCell align="right">
                  <button
                    type="button"
                    onClick={() => onViewUnit(unit)}
                    className="btn btn-sm btn-outline btn-icon ml-auto"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                </BodyCell>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted bg-slate-50 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={`px-5 py-3.5 align-middle ${align === 'right' ? 'text-right' : 'text-left'} ${className}`.trim()}>
      {children}
    </td>
  );
}
