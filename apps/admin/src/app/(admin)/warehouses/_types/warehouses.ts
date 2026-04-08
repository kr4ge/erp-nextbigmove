export type WarehouseStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type LocationType =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PICKING'
  | 'PACKING'
  | 'STAGING'
  | 'RETURNS'
  | 'DAMAGE'
  | 'QUARANTINE'
  | 'DISPATCH';

export type WmsLocation = {
  id: string;
  warehouseId: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  type: LocationType;
  status: LocationStatus;
  isDefault: boolean;
  barcode: string | null;
  capacityUnits: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  parentName: string | null;
  parentCode: string | null;
  childrenCount: number;
};

export type WmsWarehouse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: WarehouseStatus;
  isDefault: boolean;
  contactName: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  locationsCount: number;
  activeLocationsCount: number;
  locations: WmsLocation[];
};

export type WarehouseFormState = {
  code: string;
  name: string;
  description: string;
  status: WarehouseStatus;
  isDefault: boolean;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string;
};

export type LocationFormState = {
  code: string;
  name: string;
  description: string;
  type: LocationType;
  status: LocationStatus;
  isDefault: boolean;
  parentId: string;
  barcode: string;
  capacityUnits: string;
  sortOrder: string;
};
