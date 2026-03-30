export type ShopOption = {
  shop_id: string;
  shop_name: string;
};

export type ConfirmationOrderTagDetail = {
  id: string | null;
  name: string;
};

export type ConfirmationOrderRow = {
  id: string;
  store_id?: string | null;
  shop_id: string;
  shop_name: string;
  pos_order_id: string;
  date_local: string;
  inserted_at: string;
  inserted_at_local?: string;
  status: number | null;
  status_name: string | null;
  is_abandoned?: boolean | null;
  cod: number;
  reports_by_phone_fail: number | null;
  reports_by_phone_success: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  item_data?: unknown;
  order_snapshot?: unknown;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  has_duplicated_phone?: boolean;
  has_duplicated_ip?: boolean;
  tags: string[];
  tags_detail?: ConfirmationOrderTagDetail[];
};

export type ConfirmationResponse = {
  items: ConfirmationOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  filters: {
    shops: ShopOption[];
  };
  selected: {
    start_date: string;
    end_date: string;
    shop_ids: string[];
    search: string;
  };
};

export type PhoneHistoryResponse = {
  items: ConfirmationOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  selected: {
    phone: string;
    canonical_phone: string;
  };
};

export type TagOptionItem = {
  tag_id: string;
  name: string;
};

export type TagOptionGroup = {
  group_id: string;
  group_name: string;
  tags: TagOptionItem[];
};

export type ConfirmationTagOptionsResponse = {
  order_id: string;
  shop_id: string;
  groups: TagOptionGroup[];
  individual: TagOptionItem[];
  total: number;
};

export type ProductOptionItem = {
  variation_id: string;
  product_id: string;
  custom_id: string | null;
  name: string;
  retail_price: number;
  image_url: string | null;
};

export type ConfirmationProductOptionsResponse = {
  order_id: string;
  shop_id: string;
  warehouse_id: string | null;
  warehouse_name: string | null;
  items: ProductOptionItem[];
  total: number;
};

export type GeoProvinceOption = {
  id: string;
  name: string;
  name_en?: string | null;
};

export type GeoDistrictOption = {
  id: string;
  name: string;
  name_en?: string | null;
};

export type GeoCommuneOption = {
  id: string;
  district_id: string;
  name: string;
  name_en?: string | null;
};

export type GeoProvincesResponse = {
  items?: GeoProvinceOption[];
};

export type GeoDistrictsResponse = {
  items?: GeoDistrictOption[];
};

export type GeoCommunesResponse = {
  items?: GeoCommuneOption[];
};

export type ConfirmationResponseItemRaw = ConfirmationOrderRow & {
  isAbandoned?: boolean | null;
  status?: number | string | null;
};

export type ParsedSnapshotItem = {
  id: string;
  variationId: string;
  warehouseId: string;
  quantity: number;
  name: string;
  productDisplayId: string;
  displayId: string;
  retailPrice: number;
  imageUrl: string;
};

export type ParsedDeliveryAddress = {
  id: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  fullAddress: string;
  communeName: string;
  districtName: string;
  provinceName: string;
  communeId: string;
  districtId: string;
  provinceId: string;
  countryCode: string;
  postCode: string;
  payloadWithoutId: Record<string, unknown>;
};

export type ParsedOrderSnapshotCustomer = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  conversationLink: string;
  shopCustomerAddresses: ParsedDeliveryAddress[];
  succeedOrderCount: number;
  orderCount: number;
};

export type ParsedOrderSnapshotPayment = {
  totalDiscount: number;
  shippingFee: number;
  surcharge: number;
  bankPaymentsRaw: unknown;
  bankTransfer: number;
};

export type ParsedOrderSnapshot = {
  note: string;
  notePrint: string;
  warehouseId: string;
  items: ParsedSnapshotItem[];
  customer: ParsedOrderSnapshotCustomer;
  shippingAddress: ParsedDeliveryAddress;
  payment: ParsedOrderSnapshotPayment;
  orderLink: string;
  conversationId: string;
  duplicatedPhone: boolean;
  duplicatedIp: boolean;
};

export type TenantSocketPayload = {
  tenantId?: string;
  teamId?: string | null;
};

export type OrderStatusMeta = {
  label: string;
  color: string;
};

export type EditableDeliveryField =
  | 'fullName'
  | 'phoneNumber'
  | 'address'
  | 'fullAddress'
  | 'communeName'
  | 'districtName'
  | 'provinceName'
  | 'postCode';
