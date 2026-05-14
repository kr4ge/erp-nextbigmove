export type PosOrdersReportQtyBlock = {
  all_orders: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returning: number;
  returned: number;
  restocking: number;
  in_process: number;
  rts_rate: number;
  pending_rate: number;
  cancellation_rate: number;
};

export type PosOrdersReportRevenueBlock = {
  all_orders: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returning: number;
  returned: number;
  restocking: number;
  in_process: number;
};

export type PosOrdersReportItem = {
  shop_id: string;
  pos_store_name: string;
  qty: PosOrdersReportQtyBlock;
  revenue: PosOrdersReportRevenueBlock;
};

export type PosOrdersReportResponse = {
  items: PosOrdersReportItem[];
  row_count: number;
  selected: {
    start_date: string;
    end_date: string;
  };
  generated_at: string;
};

export type PosOrdersReportTotals = {
  qty: PosOrdersReportQtyBlock;
  revenue: PosOrdersReportRevenueBlock;
};
