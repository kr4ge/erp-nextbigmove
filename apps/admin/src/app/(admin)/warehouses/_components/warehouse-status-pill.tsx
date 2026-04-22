import type { WmsWarehouseStatus } from '../_types/warehouse';

const statusClassMap: Record<WmsWarehouseStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  INACTIVE: 'border-slate-200 bg-slate-50 text-slate-600',
  ARCHIVED: 'border-amber-200 bg-amber-50 text-amber-700',
};

export function WarehouseStatusPill({ status }: { status: WmsWarehouseStatus }) {
  return (
    <span className={`wms-chip rounded-full border font-medium ${statusClassMap[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}
