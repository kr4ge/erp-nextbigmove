import type { BootstrapResponse, DeviceIdentity, StoredSession } from '@/src/features/auth/types';
import {
  canUseAssignedRtsWorkspace,
  canUseAssignedInventoryWorkspace,
  canUseStoxStockWorkspace,
} from '@/src/features/home/rbac';
import type { StoxTaskRoute } from '@/src/features/home/types';
import { StockWorkspace } from '@/src/features/stock/components/stock-workspace';
import { RtsTab } from './rts-tab';
import { BlockedTaskState, TaskHeader } from './stox-primitives';

export function InventoryTab({
  bootstrap,
  device,
  session,
  onRefresh,
  route,
}: {
  bootstrap: BootstrapResponse;
  device: DeviceIdentity | null;
  session: StoredSession;
  onRefresh: () => Promise<void>;
  route?: StoxTaskRoute | null;
}) {
  const canUseInventory = canUseAssignedInventoryWorkspace(bootstrap);
  const canUseStockWorkspace = canUseStoxStockWorkspace(bootstrap);
  const canUseRts = canUseAssignedRtsWorkspace(bootstrap);

  if (!canUseInventory && !canUseRts) {
    return (
      <>
        <TaskHeader title="Inventory" />
        <BlockedTaskState copy="This account needs an INVENTORY task assignment or RTS access to use Inventory tasks." />
      </>
    );
  }

  if (!canUseStockWorkspace && !canUseRts) {
    return (
      <>
        <TaskHeader title="Inventory" />
        <BlockedTaskState
          title="Inventory tasks unavailable"
          copy="This account is assigned to Inventory, but its WMS role cannot run stock putaway, move, or count workflows yet."
        />
      </>
    );
  }

  if (!canUseStockWorkspace && canUseRts) {
    return (
      <RtsTab
        bootstrap={bootstrap}
        device={device}
        initialReturnFlow={route?.rtsReturnFlow ?? null}
        initialTask={route?.rtsTask ?? null}
        session={session}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <>
      <StockWorkspace
        bootstrap={bootstrap}
        device={device}
        initialView={route?.inventoryView}
        routeKey={route?.key}
        rtsInitialReturnFlow={route?.rtsReturnFlow ?? null}
        rtsInitialTask={route?.rtsTask ?? null}
        session={session}
        onRefresh={onRefresh}
        variant="task"
      />
    </>
  );
}
