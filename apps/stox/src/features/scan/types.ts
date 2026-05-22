import type { WmsMobilePickingTask } from '@/src/features/picking/types';
import type {
  WmsMobileBasketLookupResult,
  WmsMobileStockBatchDetail,
  WmsMobileStockBinDetail,
  WmsMobileStockUnitDetail,
} from '@/src/features/stock/types';

export type UniversalScanFilters = {
  tenantId: string | null;
};

export type UniversalScanResult =
  | {
      kind: 'unit';
      unit: WmsMobileStockUnitDetail;
      task: WmsMobilePickingTask | null;
    }
  | {
      kind: 'bin';
      bin: WmsMobileStockBinDetail;
    }
  | {
      kind: 'batch';
      batch: WmsMobileStockBatchDetail;
    }
  | {
      kind: 'basket';
      basket: WmsMobileBasketLookupResult['basket'];
    }
  | {
      kind: 'tracking';
      task: WmsMobilePickingTask;
    };
