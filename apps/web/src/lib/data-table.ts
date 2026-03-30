import type { Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

export type DataTableSection = "head" | "body";
export type DataTableRowVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error";

const rowVariantClassMap: Record<DataTableRowVariant, string> = {
  default: "",
  info: "bg-blue-50/45",
  success: "bg-emerald-50/45",
  warning: "bg-amber-50/45",
  error: "bg-rose-50/45",
};

export function getCommonPinningStyles<TData>({
  column,
}: {
  column: Column<TData>;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow: isLastLeftPinnedColumn
      ? "-4px 0 4px -4px gray inset"
      : isFirstRightPinnedColumn
        ? "4px 0 4px -4px gray inset"
        : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.95 : 1,
    position: isPinned ? "sticky" : "relative",
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
  };
}

export function getPinnedCellClassName<TData>({
  column,
  section = "body",
}: {
  column: Column<TData>;
  section?: DataTableSection;
}) {
  if (!column.getIsPinned()) return "";
  return section === "head" ? "bg-[#F8FAFC]" : "bg-white";
}

export function getDataTableRowVariantClassName(
  variant?: DataTableRowVariant | null,
) {
  if (!variant) return "";
  return rowVariantClassMap[variant] ?? "";
}

export function getRowHoverClassName(isClickable = false) {
  return cn(
    "transition-colors",
    isClickable ? "cursor-pointer hover:bg-[#F8FAFC]" : "hover:bg-[#F8FAFC]",
  );
}
