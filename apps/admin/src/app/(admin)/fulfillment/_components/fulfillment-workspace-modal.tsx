"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  ScanLine,
  ShieldAlert,
  X,
} from "lucide-react";
import { FulfillmentStatusBadge } from "./fulfillment-status-badge";
import type {
  WmsFulfillmentOrder,
  WmsFulfillmentOrderStatus,
  WmsFulfillmentView,
  WmsPackingStation,
} from "../_types/fulfillment";
import {
  formatFulfillmentStatusLabel,
  formatOperatorLabel,
  formatOrderDate,
  formatShortDateTime,
} from "../_utils/fulfillment-format";

const MANUAL_STATUSES: WmsFulfillmentOrderStatus[] = [
  "PENDING",
  "WAITING_FOR_STOCK",
  "HOLD",
  "CANCELED",
];

type FulfillmentWorkspaceModalProps = {
  open: boolean;
  mode: WmsFulfillmentView;
  order: WmsFulfillmentOrder | null;
  stations: WmsPackingStation[];
  isBusy?: boolean;
  onClose: () => void;
  onStartPicking: (trackingNumber: string) => Promise<void>;
  onScanPickUnit: (unitBarcode: string) => Promise<void>;
  onAssignPacking: (payload: {
    stationId: string;
    packerUserId: string;
  }) => Promise<void>;
  onStartPacking: (trackingNumber: string) => Promise<void>;
  onScanPackUnit: (unitBarcode: string) => Promise<void>;
  onSetStatus: (status: WmsFulfillmentOrderStatus) => Promise<void>;
};

function MobileActionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReadoutPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-snug text-slate-950">
        {value}
      </p>
    </div>
  );
}

export function FulfillmentWorkspaceModal({
  open,
  mode,
  order,
  stations,
  isBusy = false,
  onClose,
  onStartPicking,
  onScanPickUnit,
  onAssignPacking,
  onStartPacking,
  onScanPackUnit,
  onSetStatus,
}: FulfillmentWorkspaceModalProps) {
  const [trackingInput, setTrackingInput] = useState("");
  const [unitInput, setUnitInput] = useState("");
  const [selectedStationId, setSelectedStationId] = useState("");
  const [selectedPackerId, setSelectedPackerId] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order) {
      return;
    }

    setTrackingInput(order.trackingNumber);
    setUnitInput("");
    setSelectedStationId(order.packingStation?.id || "");
    setSelectedPackerId(order.packerUser?.id || "");
    setFeedbackMessage(null);
    setErrorMessage(null);
  }, [open, order]);

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

  const availableStations = useMemo(() => {
    if (!order?.warehouse?.id) {
      return stations.filter((station) => station.status === "ACTIVE");
    }

    return stations.filter(
      (station) =>
        station.status === "ACTIVE" &&
        station.warehouse.id === order.warehouse?.id,
    );
  }, [order?.warehouse?.id, stations]);

  const selectedStation = useMemo(
    () =>
      availableStations.find((station) => station.id === selectedStationId) ||
      null,
    [availableStations, selectedStationId],
  );

  const stationOperators = useMemo(
    () => selectedStation?.assignedUsers || [],
    [selectedStation],
  );
  const isPickingMode = mode === "PICKING";
  const isPackingMode = mode === "PACKING";
  const isDispatchMode = mode === "DISPATCH";

  useEffect(() => {
    if (!selectedStation || stationOperators.length !== 1) {
      return;
    }

    setSelectedPackerId((current) => current || stationOperators[0]?.id || "");
  }, [selectedStation, stationOperators]);

  if (!open || !order) {
    return null;
  }

  const mobileShellClassName =
    "rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.08),_transparent_45%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3";
  const inputClassName =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100";
  const canStartPicking = ["PENDING", "WAITING_FOR_STOCK", "HOLD"].includes(
    order.status,
  );
  const canScanPicking = order.status === "PICKING";
  const needsPackingAssignment =
    (!order.packingStation || !order.packerUser) &&
    ["PICKED", "PACKING_PENDING", "PACKING_ASSIGNED"].includes(order.status);
  const canStartPacking =
    isPackingMode &&
    Boolean(order.packingStation && order.packerUser) &&
    ["PACKING_PENDING", "PACKING_ASSIGNED", "PACKING"].includes(order.status);
  const canScanPacking = order.status === "PACKING";
  const totalAssignedUnits = order.items.reduce(
    (sum, item) => sum + item.assignedUnits.length,
    0,
  );
  const showPickedHandoffNotice = isPickingMode && needsPackingAssignment;
  const scanStepTitle = isPickingMode
    ? "Step 2"
    : needsPackingAssignment
      ? "Step 3"
      : "Step 2";
  const startPackingStepTitle = needsPackingAssignment ? "Step 2" : "Step 1";

  async function runAction(
    action: () => Promise<void>,
    successMessage: string,
    reset?: () => void,
  ) {
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await action();
      if (reset) {
        reset();
      }
      setFeedbackMessage(successMessage);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Fulfillment action failed.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 sm:p-3"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:mx-auto sm:my-0 sm:h-[calc(100vh-1.5rem)] sm:w-[min(96vw,1280px)] sm:rounded-[28px] sm:border sm:border-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-4 py-3 sm:px-5">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                {isPickingMode
                  ? "Picker Workspace"
                  : isDispatchMode
                    ? "Dispatch Readout"
                    : "Packing Workspace"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {order.fulfillmentCode}
                </h2>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {order.trackingNumber}
                </span>
                <FulfillmentStatusBadge status={order.status} />
              </div>
              <p className="text-sm text-slate-500">
                {order.tenant?.name || "No partner"} ·{" "}
                {order.store?.name || "No store"} ·{" "}
                {formatOrderDate(order.orderDateLocal)}
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

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] xl:items-start">
              <div className="space-y-4">
                    {errorMessage ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMessage}
                      </div>
                    ) : null}
                    {feedbackMessage ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {feedbackMessage}
                      </div>
                    ) : null}
                    {showPickedHandoffNotice ? (
                      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                        Picking is complete. Assign one packing station and one packer to hand off this order to packing.
                      </div>
                    ) : null}
                    {isDispatchMode ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        This order is now in dispatch monitoring. Scans and timing are read-only here.
                      </div>
                    ) : null}

                {!isDispatchMode ? (
                  <div className={mobileShellClassName}>
                    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Mobile Sim
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Scanner-gun flow on web before Android.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Required
                            </p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-slate-950">
                              {order.progress.required}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Picked
                            </p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-slate-950">
                              {order.progress.picked}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Packed
                            </p>
                            <p className="mt-1 text-base font-semibold tabular-nums text-slate-950">
                              {order.progress.packed}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                            {isPickingMode ? (
                              <MobileActionCard
                                title="Step 1"
                                description="Scan the waybill first to lock the picker session to this order."
                              >
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    runAction(
                                      () =>
                                        onStartPicking(trackingInput.trim()),
                                      "Picker session started.",
                                    );
                                  }}
                                  className="space-y-3"
                                >
                                  <input
                                    value={trackingInput}
                                    onChange={(event) =>
                                      setTrackingInput(event.target.value)
                                    }
                                    className={inputClassName}
                                    placeholder="Scan tracking number"
                                  />
                                  <button
                                    type="submit"
                                    disabled={
                                      isBusy ||
                                      !trackingInput.trim() ||
                                      !canStartPicking
                                    }
                                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-orange-500 bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {canStartPicking
                                      ? "Start Picking"
                                      : "Waybill Verified"}
                                  </button>
                                </form>
                              </MobileActionCard>
                            ) : null}

                            {needsPackingAssignment ? (
                              <MobileActionCard
                                title={isPickingMode ? "Next Step" : "Step 1"}
                                description="Assign one active packing station, then choose a user already assigned to that station."
                              >
                                <div className="space-y-3">
                                  <select
                                    value={selectedStationId}
                                    onChange={(event) => {
                                      setSelectedStationId(event.target.value);
                                      setSelectedPackerId("");
                                    }}
                                    className={inputClassName}
                                  >
                                    <option value="">Select packing station</option>
                                    {availableStations.map((station) => (
                                      <option key={station.id} value={station.id}>
                                        {station.name} · {station.warehouse.name}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={selectedPackerId}
                                    onChange={(event) =>
                                      setSelectedPackerId(event.target.value)
                                    }
                                    disabled={!selectedStation}
                                    className={inputClassName}
                                  >
                                    <option value="">Select packer</option>
                                    {stationOperators.map((operator) => (
                                      <option key={operator.id} value={operator.id}>
                                        {operator.name || operator.email}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    disabled={
                                      isBusy ||
                                      !selectedStationId ||
                                      !selectedPackerId
                                    }
                                    onClick={() =>
                                      runAction(
                                        () =>
                                          onAssignPacking({
                                            stationId: selectedStationId,
                                            packerUserId: selectedPackerId,
                                          }),
                                        "Packing station assigned.",
                                      )
                                    }
                                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-orange-500 bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Assign Packing
                                  </button>
                                </div>
                              </MobileActionCard>
                            ) : null}

                          {isPackingMode ? (
                            <MobileActionCard
                              title={startPackingStepTitle}
                              description="Packer scans the same waybill to enter the station workspace."
                            >
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  runAction(
                                    () =>
                                      onStartPacking(trackingInput.trim()),
                                    "Packing session started.",
                                  );
                                }}
                                className="space-y-3"
                              >
                                <input
                                  value={trackingInput}
                                  onChange={(event) =>
                                    setTrackingInput(event.target.value)
                                  }
                                  className={inputClassName}
                                  placeholder="Scan tracking number"
                                />
                                <button
                                  type="submit"
                                  disabled={
                                    isBusy ||
                                    !trackingInput.trim() ||
                                    !canStartPacking
                                  }
                                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-orange-500 bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {canStartPacking
                                    ? "Start Packing"
                                    : "Waybill Verified"}
                                </button>
                              </form>
                            </MobileActionCard>
                          ) : null}

                          <MobileActionCard
                            title={scanStepTitle}
                            description={
                              isPickingMode
                                ? "Scan every serialized unit. Wrong products are blocked immediately."
                                : "Rescan the picked units before sealing the parcel."
                            }
                          >
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                runAction(
                                  () =>
                                    isPickingMode
                                      ? onScanPickUnit(unitInput.trim())
                                      : onScanPackUnit(unitInput.trim()),
                                  isPickingMode
                                    ? "Unit accepted into picking set."
                                    : "Unit accepted into packing set.",
                                  () => setUnitInput(""),
                                );
                              }}
                              className="space-y-3"
                            >
                              <div className="relative">
                                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  value={unitInput}
                                  onChange={(event) =>
                                    setUnitInput(event.target.value)
                                  }
                                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                                  placeholder="Scan serialized unit barcode"
                                  disabled={
                                    isBusy ||
                                    (isPickingMode
                                      ? !canScanPicking
                                      : !canScanPacking)
                                  }
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={
                                  isBusy ||
                                  !unitInput.trim() ||
                                  (isPickingMode ? !canScanPicking : !canScanPacking)
                                }
                                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isPickingMode ? "Add Picked Unit" : "Add Packed Unit"}
                              </button>
                            </form>
                          </MobileActionCard>
                      </div>
                    </div>
                  </div>
                ) : null}

              <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Required Items
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isPickingMode
                        ? "Match each scan to the order requirement."
                        : isDispatchMode
                          ? "This is the final scanned set that moved through packing and courier pickup."
                          : "Every packed scan must belong to the picked set."}
                    </p>
                  </div>
                  {order.shortageQuantity > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {order.shortageQuantity} short
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Scan matched
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {order.items.map((item) => {
                    const progressValue = isPickingMode
                      ? item.pickedQuantity
                      : item.packedQuantity;
                    const progressTotal = item.quantity || 1;
                    const progressWidth = Math.min(
                      (progressValue / progressTotal) * 100,
                      100,
                    );

                    return (
                      <div key={item.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {item.productName}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {item.displayCode ? (
                                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">
                                  {item.displayCode}
                                </span>
                              ) : null}
                              {item.variationName ? (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                  {item.variationName}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Need
                              </p>
                              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                                {item.quantity}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {isPickingMode ? "Picked" : "Packed"}
                              </p>
                              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                                {progressValue}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Available
                              </p>
                              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                                {item.availableUnits}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full ${
                              progressWidth >= 100
                                ? "bg-emerald-500"
                                : "bg-orange-500"
                            }`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600">
                            {item.assignedUnits.length} assigned serials
                          </span>
                          {item.shortageQuantity > 0 ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                              Short by {item.shortageQuantity}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Order Context
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Operational handoff summary.
                    </p>
                  </div>
                  <PackageCheck className="h-4 w-4 text-orange-500" />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ReadoutPill
                    label="Warehouse"
                    value={order.warehouse?.name || "Not mapped"}
                  />
                  <ReadoutPill
                    label="Picker"
                    value={formatOperatorLabel(order.pickerUser)}
                  />
                  <ReadoutPill
                    label="Station"
                    value={order.packingStation?.name || "Not assigned"}
                  />
                  <ReadoutPill
                    label="Packer"
                    value={formatOperatorLabel(order.packerUser)}
                  />
                  <ReadoutPill
                    label="Assigned Units"
                    value={String(totalAssignedUnits)}
                  />
                  <ReadoutPill
                    label="Dispatched At"
                    value={formatShortDateTime(order.dispatchedAt)}
                  />
                  <ReadoutPill
                    label="POS Status"
                    value={String(order.posStatusName || order.posStatus || "—")}
                  />
                  <ReadoutPill
                    label="Packed At"
                    value={formatShortDateTime(order.packedAt)}
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Scan Timeline
                  </p>
                </div>
                <div className="max-h-[260px] space-y-3 overflow-y-auto px-4 py-4">
                  {order.scans.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No scan events logged yet.
                    </p>
                  ) : (
                    order.scans.map((scan) => (
                      <div
                        key={scan.id}
                        className={`rounded-2xl border px-3 py-3 ${
                          scan.result === "ACCEPTED"
                            ? "border-emerald-200 bg-emerald-50/50"
                            : "border-rose-200 bg-rose-50/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                            {scan.action.replace(/_/g, " ")}
                          </p>
                          <span className="text-[11px] text-slate-500">
                            {formatShortDateTime(scan.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-950">
                          {scan.scannedValue}
                        </p>
                        {scan.message ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {scan.message}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Assigned Serials
                  </p>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  {order.items.every((item) => item.assignedUnits.length === 0) ? (
                    <div className="px-4 py-8 text-sm text-slate-500">
                      No serials claimed yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {order.items.flatMap((item) =>
                        item.assignedUnits.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="px-4 py-3 text-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-950">
                                  {assignment.unit.unitBarcode}
                                </p>
                                <p className="truncate text-slate-500">
                                  {assignment.unit.productName}
                                </p>
                              </div>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {assignment.unit.serialNo}
                              </span>
                            </div>
                          </div>
                        )),
                      )}
                    </div>
                  )}
                </div>
              </section>

              {!isDispatchMode ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Manual Override
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {MANUAL_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={isBusy || order.status === status}
                        onClick={() =>
                          runAction(
                            () => onSetStatus(status),
                            `Order moved to ${formatFulfillmentStatusLabel(status)}.`,
                          )
                        }
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {formatFulfillmentStatusLabel(status)}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
