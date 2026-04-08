import type { ChangeEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
import type {
  CreateWmsInventoryTransferInput,
  WmsInventoryUnit,
} from "../_types/inventory";
import type { WmsWarehouse } from "../../warehouses/_types/warehouses";
import { formatDateTime, formatMoney } from "../_utils/inventory-format";

export function createEmptyInventoryTransferForm(): CreateWmsInventoryTransferInput {
  return {
    warehouseId: "",
    fromLocationId: "",
    toLocationId: "",
    notes: "",
    unitIds: [],
  };
}

type InventoryTransferFormProps = {
  warehouses: WmsWarehouse[];
  sourceUnits: WmsInventoryUnit[];
  value: CreateWmsInventoryTransferInput;
  unitSearch: string;
  intentLabel: string;
  disabled?: boolean;
  allVisibleSelected: boolean;
  onChange: (value: CreateWmsInventoryTransferInput) => void;
  onUnitSearchChange: (value: string) => void;
  onToggleUnit: (unitId: string) => void;
  onToggleAllVisible: () => void;
  onClearSelection: () => void;
  onSubmit: () => void;
};

export function InventoryTransferForm({
  warehouses,
  sourceUnits,
  value,
  unitSearch,
  intentLabel,
  disabled,
  allVisibleSelected,
  onChange,
  onUnitSearchChange,
  onToggleUnit,
  onToggleAllVisible,
  onClearSelection,
  onSubmit,
}: InventoryTransferFormProps) {
  const warehouse =
    warehouses.find((item) => item.id === value.warehouseId) || null;
  const locationOptions =
    warehouse?.locations.filter((item) => item.status === "ACTIVE") || [];
  const sourceLocation =
    locationOptions.find((item) => item.id === value.fromLocationId) || null;
  const destinationOptions = locationOptions.filter(
    (item) => item.id !== value.fromLocationId,
  );

  const handleWarehouseChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const warehouseId = event.target.value;
    const nextWarehouse =
      warehouses.find((item) => item.id === warehouseId) || null;
    const nextSource =
      nextWarehouse?.locations.find(
        (item) => item.status === "ACTIVE" && item.type === "RECEIVING",
      ) ||
      nextWarehouse?.locations.find((item) => item.status === "ACTIVE") ||
      null;
    const nextDestination =
      nextWarehouse?.locations.find(
        (item) =>
          item.status === "ACTIVE" &&
          item.id !== nextSource?.id &&
          item.type === "STORAGE",
      ) ||
      nextWarehouse?.locations.find(
        (item) => item.status === "ACTIVE" && item.id !== nextSource?.id,
      ) ||
      null;

    onChange({
      ...value,
      warehouseId,
      fromLocationId: nextSource?.id || "",
      toLocationId: nextDestination?.id || "",
      unitIds: [],
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-semibold text-slate-700">Warehouse</span>
          <select
            value={value.warehouseId}
            onChange={handleWarehouseChange}
            disabled={disabled}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-orange-300"
          >
            <option value="">Select warehouse</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-semibold text-slate-700">From</span>
          <select
            value={value.fromLocationId}
            onChange={(event) =>
              onChange({
                ...value,
                fromLocationId: event.target.value,
                toLocationId:
                  value.toLocationId === event.target.value
                    ? ""
                    : value.toLocationId,
                unitIds: [],
              })
            }
            disabled={disabled || !warehouse}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-orange-300"
          >
            <option value="">Select source</option>
            {locationOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name} ({item.type})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-semibold text-slate-700">To</span>
          <select
            value={value.toLocationId}
            onChange={(event) =>
              onChange({
                ...value,
                toLocationId: event.target.value,
              })
            }
            disabled={disabled || !warehouse}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-orange-300"
          >
            <option value="">Select destination</option>
            {destinationOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name} ({item.type})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,rgba(249,115,22,0.09),rgba(255,255,255,1)_62%)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100">
              <ArrowRightLeft className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
                Transfer intent
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-950">
                {intentLabel}
              </div>
            </div>
          </div>
          <label className="w-full max-w-xs text-sm md:w-auto">
            <input
              value={unitSearch}
              onChange={(event) => onUnitSearchChange(event.target.value)}
              disabled={disabled || !value.fromLocationId}
              placeholder="Search unit barcode, SKU, lot"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Candidate units
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {sourceLocation
                ? `${sourceLocation.name} · ${sourceLocation.code}`
                : "Choose a source location first"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onToggleAllVisible}
              disabled={disabled || sourceUnits.length === 0}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allVisibleSelected ? "Clear visible" : "Select visible"}
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={disabled || value.unitIds.length === 0}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear selected
            </button>
          </div>
        </div>

        {sourceUnits.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No available units found in this source location.
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3">Pick</th>
                  <th className="py-3 pr-4">Unit</th>
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Lot</th>
                  <th className="py-3 pr-4">Cost</th>
                  <th className="py-3 pr-4">Received</th>
                </tr>
              </thead>
              <tbody>
                {sourceUnits.map((unit) => {
                  const checked = value.unitIds.includes(unit.id);

                  return (
                    <tr
                      key={unit.id}
                      className={`border-b border-slate-100 align-top last:border-b-0 ${
                        checked ? "bg-orange-50/40" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onToggleUnit(unit.id)}
                          className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
                        />
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-mono text-xs font-semibold tracking-[0.12em] text-slate-950">
                          {unit.unitBarcode}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Serial {unit.serialNo} · Batch {unit.batchSequence}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-slate-950">
                          {unit.productName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {unit.skuProfile?.code || unit.sku}
                          {unit.variationName ? ` · ${unit.variationName}` : ""}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-slate-950">
                          {unit.lot.lotCode}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {unit.location.code}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-slate-700">
                        {formatMoney(unit.lot.unitCost)}
                      </td>
                      <td className="py-4 pr-4 text-slate-600">
                        {formatDateTime(unit.receivedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label className="block space-y-2 text-sm">
        <span className="font-semibold text-slate-700">Notes</span>
        <textarea
          value={value.notes || ""}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          disabled={disabled}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300"
          placeholder="Optional transfer note"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="text-sm text-slate-500">
          {value.unitIds.length} unit{value.unitIds.length === 1 ? "" : "s"} selected
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={
            disabled ||
            !value.warehouseId ||
            !value.fromLocationId ||
            !value.toLocationId ||
            value.unitIds.length === 0
          }
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Post transfer
        </button>
      </div>
    </div>
  );
}
