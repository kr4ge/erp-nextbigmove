import type { WmsSkuProfileStatus } from "../_types/inventory";

const toneMap: Record<WmsSkuProfileStatus, string> = {
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE:
    "border-amber-200 bg-amber-50 text-amber-700",
  ARCHIVED:
    "border-slate-200 bg-slate-100 text-slate-600",
};

export function SkuProfileStatusBadge({
  status,
}: {
  status: WmsSkuProfileStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneMap[status]}`}
    >
      {status}
    </span>
  );
}
