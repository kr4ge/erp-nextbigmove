import type { WmsInventoryTransferType } from "../_types/inventory";

const toneMap: Record<WmsInventoryTransferType, string> = {
  PUT_AWAY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RELOCATION: "border-amber-200 bg-amber-50 text-amber-700",
};

export function InventoryTransferTypeBadge({
  transferType,
}: {
  transferType: WmsInventoryTransferType;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneMap[transferType]}`}
    >
      {transferType === "PUT_AWAY" ? "Put-away" : "Relocation"}
    </span>
  );
}
