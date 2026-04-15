"use client";

import { cn } from "@/lib/utils";
import type {
  WmsFulfillmentOrderStatus,
  WmsPackingStationStatus,
} from "../_types/fulfillment";
import { formatFulfillmentStatusLabel } from "../_utils/fulfillment-format";

const ORDER_TONES: Record<WmsFulfillmentOrderStatus, string> = {
  PENDING: "border-slate-200 bg-slate-50 text-slate-700",
  WAITING_FOR_STOCK: "border-amber-200 bg-amber-50 text-amber-700",
  PICKING: "border-sky-200 bg-sky-50 text-sky-700",
  PICKED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PACKING_PENDING: "border-slate-200 bg-slate-50 text-slate-700",
  PACKING_ASSIGNED: "border-purple-200 bg-purple-50 text-purple-700",
  PACKING: "border-orange-200 bg-orange-50 text-orange-700",
  PACKED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DISPATCHED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  HOLD: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELED: "border-slate-200 bg-slate-100 text-slate-500",
};

const STATION_TONES: Record<WmsPackingStationStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-500",
};

type FulfillmentStatusBadgeProps =
  | {
      kind?: "order";
      status: WmsFulfillmentOrderStatus;
    }
  | {
      kind: "station";
      status: WmsPackingStationStatus;
    };

export function FulfillmentStatusBadge(
  props: FulfillmentStatusBadgeProps,
) {
  const className =
    props.kind === "station"
      ? STATION_TONES[props.status]
      : ORDER_TONES[props.status];
  const label =
    props.kind === "station"
      ? props.status === "ACTIVE"
        ? "Active"
        : "Inactive"
      : formatFulfillmentStatusLabel(props.status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        className,
      )}
    >
      {label}
    </span>
  );
}
