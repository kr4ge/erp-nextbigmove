export type WmsWarehouseStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type WmsLocationKind =
  | 'SECTION'
  | 'RACK'
  | 'BIN'
  | 'RECEIVING_STAGING'
  | 'PACKING'
  | 'DISPATCH_STAGING'
  | 'RTS'
  | 'DAMAGE'
  | 'QUARANTINE';

export type WmsWarehouseListItem = {
  id: string;
  code: string;
  name: string;
  billingCompanyName: string | null;
  bankName: string | null;
  status: WmsWarehouseStatus;
  locationCount: number;
  structuralLocationCount: number;
  operationalLocationCount: number;
  sectionCount: number;
  rackCount: number;
  binCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WmsLocationTreeNode = {
  id: string;
  parentId: string | null;
  kind: WmsLocationKind;
  code: string;
  name: string;
  barcode: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
  children: WmsLocationTreeNode[];
};

export type WmsWarehouseDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  billingCompanyName: string | null;
  billingAddress: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  bankBranch: string | null;
  paymentInstructions: string | null;
  status: WmsWarehouseStatus;
  stats: {
    totalLocations: number;
    sections: number;
    racks: number;
    bins: number;
    operational: number;
  };
  operationalLocations: WmsLocationTreeNode[];
  structuralLocations: WmsLocationTreeNode[];
  rootLocations: WmsLocationTreeNode[];
  inventorySummary: {
    serializedUnits: number;
    putAwayUnits: number;
    stagedUnits: number;
    attentionUnits: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type WmsWarehousesOverviewResponse = {
  summary: {
    warehouses: number;
    activeWarehouses: number;
    locations: number;
    structuralLocations: number;
    operationalLocations: number;
  };
  warehouses: WmsWarehouseListItem[];
  activeWarehouseId: string | null;
  activeWarehouse: WmsWarehouseDetail | null;
};

export type WmsWarehouseBinDetailResponse = {
  bin: {
    id: string;
    code: string;
    name: string;
    barcode: string;
    capacity: number | null;
    occupiedUnits: number;
    availableUnits: number | null;
    isFull: boolean;
    warehouse: {
      id: string;
      code: string;
      name: string;
    };
    section: {
      id: string;
      code: string;
      name: string;
    };
    rack: {
      id: string;
      code: string;
      name: string;
    };
  };
  units: Array<{
    id: string;
    code: string;
    barcode: string;
    status: string;
    productName: string;
    productCustomId: string | null;
    sourceRefLabel: string | null;
    receivingBatch: {
      id: string;
      code: string;
    } | null;
    updatedAt: string;
  }>;
};

export type CreateWmsWarehouseInput = {
  code: string;
  name: string;
  description?: string;
  address?: string;
  billingCompanyName?: string;
  billingAddress?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  bankBranch?: string;
  paymentInstructions?: string;
  status?: WmsWarehouseStatus;
  autoSeedOperationalLocations?: boolean;
};

export type UpdateWmsWarehouseInput = Partial<CreateWmsWarehouseInput>;

export type CreateWmsLocationInput = {
  parentId?: string;
  kind: WmsLocationKind;
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  capacity?: number;
};

export type UpdateWmsLocationInput = Partial<CreateWmsLocationInput>;
