export interface PosStore {
  id: string;
  name: string;
  shopId: string;
  shopName?: string;
  shopAvatarUrl?: string;
  description?: string;
  status?: string;
  enabled?: boolean;
  apiKey?: string;
  createdAt?: string;
  initialValueOffer?: number | null;
}

export interface StoreOrderDateRange {
  startDate: string | Date | null;
  endDate: string | Date | null;
}
