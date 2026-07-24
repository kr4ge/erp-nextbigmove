import type { WmsInventoryUnitStatus } from '../_types/inventory';
import { getInventoryExpirationState } from '../_utils/inventory-status-presenters';

type InventoryExpirationBadgeProps = {
  expirationDate: string | null;
  status?: WmsInventoryUnitStatus | string;
};

const EXPIRATION_BADGE_STYLES = {
  EXPIRES_TODAY: {
    label: 'Expires today',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'border-red-300 bg-red-50 text-red-800',
  },
} as const;

export function InventoryExpirationBadge({
  expirationDate,
  status,
}: InventoryExpirationBadgeProps) {
  const expirationState = status === 'EXPIRED'
    ? 'EXPIRED'
    : getInventoryExpirationState(expirationDate);

  if (expirationState !== 'EXPIRES_TODAY' && expirationState !== 'EXPIRED') {
    return null;
  }

  const badge = EXPIRATION_BADGE_STYLES[expirationState];

  return (
    <span className={`pill ${badge.className}`}>
      {badge.label}
    </span>
  );
}
