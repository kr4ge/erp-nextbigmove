export type WmsInventoryUnitStatus =
  | 'RECEIVED'
  | 'STAGED'
  | 'PUTAWAY'
  | 'RESERVED'
  | 'PICKED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'RTS'
  | 'DAMAGED'
  | 'ARCHIVED';

export type WmsInventoryUnitRecord = {
  id: string;
  code: string;
  barcode: string;
  status: WmsInventoryUnitStatus;
  labelPrintCount: number;
  firstLabelPrintedAt: string | null;
  lastLabelPrintedAt: string | null;
  productId: string;
  productCustomId: string | null;
  variationId: string;
  variationDisplayId: string | null;
  name: string;
  store: {
    id: string;
    name: string;
  };
  warehouse: {
    id: string;
    code: string;
    name: string;
  };
  currentLocation: {
    id: string;
    code: string;
    name: string;
    kind: 'SECTION' | 'RACK' | 'BIN' | 'RECEIVING_STAGING' | 'PACKING' | 'DISPATCH_STAGING' | 'RTS' | 'DAMAGE' | 'QUARANTINE';
    label: string;
  } | null;
  source: {
    type: 'RECEIVING' | 'MANUAL_INPUT' | 'RTS' | 'ADJUSTMENT' | 'MIGRATION';
    refId: string | null;
    label: string | null;
  } | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WmsInventoryMovementRecord = {
  id: string;
  movementType: 'RECEIPT' | 'MANUAL_RECEIPT' | 'PUTAWAY' | 'TRANSFER' | 'ADJUSTMENT';
  fromStatus: WmsInventoryUnitStatus | null;
  fromStatusLabel: string | null;
  toStatus: WmsInventoryUnitStatus | null;
  toStatusLabel: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceCode: string | null;
  notes: string | null;
  fromLocation: WmsInventoryUnitRecord['currentLocation'] | null;
  toLocation: WmsInventoryUnitRecord['currentLocation'] | null;
  actor: {
    name: string;
    email: string;
  } | null;
  createdAt: string;
};

export type WmsInventoryTransferOptionsResponse = {
  unit: {
    id: string;
    code: string;
    status: WmsInventoryUnitStatus;
    warehouse: WmsInventoryUnitRecord['warehouse'];
    currentLocation: WmsInventoryUnitRecord['currentLocation'];
  };
  sections: Array<{
    id: string;
    code: string;
    name: string;
    label: string;
    racks: Array<{
      id: string;
      code: string;
      name: string;
      label: string;
      bins: Array<{
        id: string;
        code: string;
        name: string;
        label: string;
        capacity: number | null;
        occupiedUnits: number;
        availableUnits: number | null;
        isFull: boolean;
      }>;
    }>;
  }>;
  operationalLocations: Array<{
    id: string;
    code: string;
    name: string;
    kind: WmsInventoryUnitRecord['currentLocation'] extends { kind: infer T } ? T : string;
    label: string;
  }>;
};

export type WmsInventoryOverviewResponse = {
  tenantReady: boolean;
  summary: {
    units: number;
    locatedUnits: number;
    unlocatedUnits: number;
  };
  filters: {
    tenants: Array<{
      id: string;
      label: string;
      slug: string;
      status: string;
    }>;
    stores: Array<{
      id: string;
      label: string;
      unitCount: number;
    }>;
    warehouses: Array<{
      id: string;
      code: string;
      label: string;
      unitCount: number;
    }>;
    statuses: Array<{
      value: WmsInventoryUnitStatus;
      label: string;
      unitCount: number;
    }>;
    activeTenantId: string | null;
    activeStoreId: string | null;
    activeWarehouseId: string | null;
    activeStatus: WmsInventoryUnitStatus | null;
  };
  units: WmsInventoryUnitRecord[];
};

export type GetWmsInventoryOverviewParams = {
  tenantId?: string;
  storeId?: string;
  warehouseId?: string;
  search?: string;
  status?: WmsInventoryUnitStatus;
};

export type CreateWmsInventoryTransferInput = {
  unitIds: string[];
  targetLocationId: string;
  notes?: string;
};
