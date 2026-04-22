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
  onViewUnit: (unit: WmsInventoryUnitRecord) => void;
};

export function InventoryUnitsTable({
  units,
  isLoading,
  tenantReady,
  onViewUnit,
}: InventoryUnitsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-[#eaf0f4] text-left">
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
              <td colSpan={8} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                Loading units…
              </td>
            </tr>
          ) : !tenantReady ? (
            <tr>
              <td colSpan={8} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                No tenant scope is active for inventory.
              </td>
            </tr>
          ) : units.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-14 text-center text-sm text-[#6a7e8b]">
                No units yet. Receiving will create serialized stock here.
              </td>
            </tr>
          ) : (
            units.map((unit) => (
              <tr key={unit.id} className="border-b border-[#edf2f6] text-[13px] text-[#12384b]">
                <BodyCell className="font-semibold text-[#12384b]">
                  <div className="min-w-0">
                    <div className="truncate">{unit.code}</div>
                    <div className="mt-1 truncate text-[11px] font-medium text-[#7c8f9b]">{unit.barcode}</div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#12384b]">
                      {unit.variationDisplayId ?? '—'}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">
                      {unit.productCustomId ? `Product ${unit.productCustomId}` : 'No product ID'}
                    </div>
                  </div>
                </BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#12384b]">{unit.name}</div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">{unit.productId}</div>
                  </div>
                </BodyCell>

                <BodyCell>{unit.store.name}</BodyCell>

                <BodyCell>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#12384b]">{unit.warehouse.name}</div>
                    <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">{unit.warehouse.code}</div>
                  </div>
                </BodyCell>

                <BodyCell>
                  {unit.currentLocation ? (
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#12384b]">{unit.currentLocation.code}</div>
                      <div className="mt-1 truncate text-[11px] text-[#7c8f9b]">{unit.currentLocation.name}</div>
                    </div>
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
                    className="inline-flex items-center gap-2 rounded-full border border-[#d7e0e7] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#12384b] transition hover:border-[#c6d4dd] hover:bg-[#f8fafb]"
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
      className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8193a0] ${
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
