import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import type { WmsMobileTrackingReturnFlow } from '@/src/features/stock/types';

export type StoxTabKey = 'home' | 'tasks' | 'scan' | 'history' | 'account';
export type StoxTaskMode = 'pick' | 'pack' | 'inventory';
export type InventoryTaskView = 'stock' | 'count' | 'rts';

export type StoxTaskRoute = {
  key: number;
  mode: StoxTaskMode;
  inventoryView?: InventoryTaskView;
  rtsTask?: WmsMobilePickingTask | null;
  rtsReturnFlow?: WmsMobileTrackingReturnFlow | null;
};
