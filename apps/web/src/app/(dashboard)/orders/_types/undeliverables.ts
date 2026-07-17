export type UndeliverableAssignee = {
  user_id: string;
  full_name: string;
  email: string;
};

export type UndeliverableRemarkPreview = {
  id: string;
  remark: string;
  created_at: string;
  updated_at: string;
  author_name: string;
};

export type UndeliverableRow = {
  id: string;
  pos_order_id: string;
  date_local: string;
  status: number | null;
  status_name: string | null;
  tracking: string | null;
  cod_amount: number | null;
  attempt_failed: number;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  store_id: string | null;
  store_name: string;
  shop_id: string;
  sa_assigned: UndeliverableAssignee[];
  latest_remark: UndeliverableRemarkPreview | null;
};

export type UndeliverableStoreFilterOption = {
  store_id: string;
  shop_id: string;
  store_name: string;
};

export type UndeliverableStatusFilterOption = {
  value: string;
  label: string;
};

export type UndeliverablesResponse = {
  items: UndeliverableRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  filters: {
    stores: UndeliverableStoreFilterOption[];
    statuses: UndeliverableStatusFilterOption[];
  };
  selected: {
    start_date: string;
    end_date: string;
    store_ids: string[];
    statuses: string[];
    search: string;
  };
  scope: {
    mode: 'all' | 'assigned';
  };
};

export type UndeliverableAssignmentUser = {
  user_id: string;
  full_name: string;
  email: string;
};

export type UndeliverablesAssignmentsResponse = {
  users: UndeliverableAssignmentUser[];
  stores: UndeliverableStoreFilterOption[];
  assignments: Array<{
    userId: string;
    storeId: string;
  }>;
};

export type UndeliverableRemarkItem = {
  id: string;
  remark: string;
  created_at: string;
  updated_at: string;
  created_by_id: string;
  updated_by_id: string | null;
  created_by_name: string;
  updated_by_name: string | null;
};

export type UndeliverableRemarkOption = {
  id: string;
  remark: string;
  created_at: string;
  updated_at: string;
};

export type UndeliverableRemarksResponse = {
  order: {
    id: string;
    pos_order_id: string;
    status: number | null;
    tracking: string | null;
    date_local: string;
    store_name: string;
  };
  items: UndeliverableRemarkItem[];
};

export type UndeliverableRemarkOptionsResponse = {
  items: UndeliverableRemarkOption[];
};
