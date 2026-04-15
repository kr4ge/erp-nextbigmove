"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import type { WmsWarehouse } from "../../warehouses/_types/warehouses";
import type {
  CreateWmsPackingStationInput,
  WmsFulfillmentOperator,
  WmsPackingStation,
} from "../_types/fulfillment";

type PackingStationModalProps = {
  open: boolean;
  station: WmsPackingStation | null;
  warehouses: WmsWarehouse[];
  operators: WmsFulfillmentOperator[];
  onClose: () => void;
  onSubmit: (payload: CreateWmsPackingStationInput) => Promise<void>;
  isSaving: boolean;
};

const EMPTY_FORM: CreateWmsPackingStationInput = {
  warehouseId: "",
  code: "",
  name: "",
  status: "ACTIVE",
  notes: "",
  assignedUserIds: [],
};

export function PackingStationModal({
  open,
  station,
  warehouses,
  operators,
  onClose,
  onSubmit,
  isSaving,
}: PackingStationModalProps) {
  const [form, setForm] = useState<CreateWmsPackingStationInput>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setErrorMessage(null);
    setForm(
      station
        ? {
            warehouseId: station.warehouse.id,
            code: station.code,
            name: station.name,
            status: station.status,
            notes: station.notes || "",
            assignedUserIds: station.assignedUsers.map((user) => user.id),
          }
        : EMPTY_FORM,
    );
  }, [open, station]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.status === "ACTIVE"),
    [warehouses],
  );

  if (!open) {
    return null;
  }

  const inputClassName =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!form.warehouseId || !form.code.trim() || !form.name.trim()) {
      setErrorMessage("Warehouse, station code, and name are required.");
      return;
    }

    try {
      await onSubmit({
        warehouseId: form.warehouseId,
        code: form.code.trim(),
        name: form.name.trim(),
        status: form.status || "ACTIVE",
        notes: form.notes?.trim() || undefined,
        assignedUserIds: form.assignedUserIds?.length
          ? form.assignedUserIds
          : undefined,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save packing station.",
      );
    }
  }

  function toggleOperator(userId: string) {
    setForm((current) => {
      const assignedUserIds = new Set(current.assignedUserIds || []);

      if (assignedUserIds.has(userId)) {
        assignedUserIds.delete(userId);
      } else {
        assignedUserIds.add(userId);
      }

      return {
        ...current,
        assignedUserIds: Array.from(assignedUserIds),
      };
    });
  }

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center">
          <div className="flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-5 py-4">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                  Packing Stations
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {station ? "Edit Station" : "New Station"}
                </h2>
                <p className="text-sm text-slate-500">
                  Assign only the operators allowed to receive packing work from
                  the picker queue.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-orange-200 hover:text-orange-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-4">
                    {errorMessage ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMessage}
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Warehouse
                        </span>
                        <select
                          value={form.warehouseId}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              warehouseId: event.target.value,
                            }))
                          }
                          className={inputClassName}
                        >
                          <option value="">Select warehouse</option>
                          {activeWarehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Status
                        </span>
                        <select
                          value={form.status || "ACTIVE"}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              status: event.target.value as
                                | "ACTIVE"
                                | "INACTIVE",
                            }))
                          }
                          className={inputClassName}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Station Code
                        </span>
                        <input
                          value={form.code}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              code: event.target.value,
                            }))
                          }
                          placeholder="PK-01"
                          className={inputClassName}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Station Name
                        </span>
                        <input
                          value={form.name}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Packing Bay 01"
                          className={inputClassName}
                        />
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Notes
                      </span>
                      <textarea
                        value={form.notes || ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="Shift coverage or operational notes"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      />
                    </label>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Assigned Operators
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Only these users can be chosen during packer
                          assignment.
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {(form.assignedUserIds || []).length} selected
                      </span>
                    </div>

                    <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                      {operators.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                          No fulfillment operators available yet.
                        </div>
                      ) : (
                        operators.map((operator) => {
                          const selected = Boolean(
                            form.assignedUserIds?.includes(operator.id),
                          );

                          return (
                            <button
                              key={operator.id}
                              type="button"
                              onClick={() => toggleOperator(operator.id)}
                              className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                                selected
                                  ? "border-orange-200 bg-orange-50"
                                  : "border-slate-200 bg-white hover:border-orange-200"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">
                                  {operator.name || operator.email}
                                </p>
                                <p className="truncate text-sm text-slate-500">
                                  {operator.email}
                                </p>
                                {operator.roleName ? (
                                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                                    {operator.roleName}
                                  </p>
                                ) : null}
                              </div>
                              <span
                                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? "border-orange-300 bg-orange-500 text-white"
                                    : "border-slate-200 bg-white text-transparent"
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-4">
                <p className="text-sm text-slate-500">
                  Packing work can only be assigned to active stations with
                  mapped users.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-orange-500 bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving
                      ? "Saving..."
                      : station
                        ? "Save Station"
                        : "Create Station"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
