import { WmsInventoryUnitStatus, WmsReceivingBatchStatus } from '@prisma/client';

export const RECEIVING_BATCH_COMPLETED_BIN_UNIT_STATUSES = [
  WmsInventoryUnitStatus.PUTAWAY,
  WmsInventoryUnitStatus.DEADSTOCK,
] as const;

export const RECEIVING_BATCH_COMPLETED_NON_BIN_UNIT_STATUSES = [
  WmsInventoryUnitStatus.RESERVED,
  WmsInventoryUnitStatus.PICKED,
  WmsInventoryUnitStatus.PACKED,
  WmsInventoryUnitStatus.DISPATCHED,
  WmsInventoryUnitStatus.RTS,
  WmsInventoryUnitStatus.DAMAGED,
  WmsInventoryUnitStatus.LOST,
  WmsInventoryUnitStatus.ARCHIVED,
] as const;

export function deriveReceivingBatchStatus(params: {
  totalUnits: number;
  stagedUnits: number;
  completedUnits: number;
}) {
  const { totalUnits, stagedUnits, completedUnits } = params;

  if (totalUnits > 0 && completedUnits === totalUnits) {
    return WmsReceivingBatchStatus.COMPLETED;
  }

  if (totalUnits > 0 && stagedUnits === totalUnits) {
    return WmsReceivingBatchStatus.STAGED;
  }

  return WmsReceivingBatchStatus.PUTAWAY_PENDING;
}
