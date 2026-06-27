import type { ShopOption } from './confirmation';

export type AgingOrdersSummaryBucketKey =
  | 'new_orders'
  | 'restocking'
  | 'confirmed'
  | 'printed'
  | 'waiting_pickup'
  | 'shipped'
  | 'rts';

export type AgingOrdersSummaryRow = {
  shop_id: string;
  shop_name: string;
  total_orders: number;
  new_orders: number;
  restocking: number;
  confirmed: number;
  printed: number;
  waiting_pickup: number;
  shipped: number;
  rts: number;
};

export type AgingOrdersSummaryResponse = {
  items: AgingOrdersSummaryRow[];
  filters: {
    shops: ShopOption[];
  };
  selected: {
    threshold_days: number;
  };
  generated_at: string;
  notification_cells: Record<string, boolean>;
};

export type AgingOrdersSummaryUnreadNotificationCountResponse = {
  count: number;
};

export type OrderStatusSummaryRow = {
  shop_id: string;
  shop_name: string;
  total_orders: number;
  new_orders: number;
  restocking: number;
  confirmed: number;
  printed: number;
  waiting_pickup: number;
  shipped: number;
  delivered: number;
  returning: number;
  returned: number;
  cancelled: number;
  deleted: number;
};

export type OrderStatusSummaryResponse = {
  items: OrderStatusSummaryRow[];
  filters: {
    shops: ShopOption[];
  };
  selected: {
    date_local: string;
    shop_ids: string[];
  };
  generated_at: string;
};
