import { ChevronDown } from 'lucide-react';
import { formatStatusLabel, getHistoryStatusBadgeColor } from '../_utils/status';

type StatusBadgeProps = {
  status: number | string | null;
  statusName?: string | null;
  isAbandoned?: boolean | null;
  className?: string;
  showChevron?: boolean;
};

export function StatusBadge({
  status,
  statusName,
  isAbandoned,
  className,
  showChevron = true,
}: StatusBadgeProps) {
  const statusLabel = formatStatusLabel(status, statusName, isAbandoned);
  const statusColor = getHistoryStatusBadgeColor(status, isAbandoned);

  return (
    <div
      className={`inline-flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm ${
        className || ''
      }`}
      style={{ backgroundColor: statusColor }}
    >
      <span className="truncate">{statusLabel}</span>
      {showChevron ? <ChevronDown className="h-3 w-3 shrink-0 text-white/90" /> : null}
    </div>
  );
}
