"use client";

import { cn } from "@/lib/utils";
import type { WmsInventoryUnitStatus } from "../_types/inventory";

const STATUS_STYLES: Record<WmsInventoryUnitStatus, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RESERVED: "border-sky-200 bg-sky-50 text-sky-700",
  PICKED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  PACKED: "border-violet-200 bg-violet-50 text-violet-700",
  DISPATCHED: "border-slate-200 bg-slate-100 text-slate-700",
  RETURNED: "border-amber-200 bg-amber-50 text-amber-700",
  DAMAGED: "border-rose-200 bg-rose-50 text-rose-700",
  ADJUSTED_OUT: "border-orange-200 bg-orange-50 text-orange-700",
};

export function InventoryUnitStatusBadge({
  status,
}: {
  status: WmsInventoryUnitStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
