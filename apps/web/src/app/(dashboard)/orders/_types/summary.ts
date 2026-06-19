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
